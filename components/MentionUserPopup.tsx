import React, { useEffect, useRef } from 'react';

// Define the props the MentionUserPopup component accepts.
interface MentionUserPopupProps {
  users: { username: string; display_name?: string }[];  // List of users to display as suggestions
  query: string;                                         // Current mention query string (not used directly here, but can be used for filtering)
  onSelect: (user: { username: string; display_name?: string }) => void;  // Callback when a user is selected
  onClose: () => void;                                   // Callback to close the popup
  anchorRef: React.RefObject<HTMLInputElement>;          // Reference to the input element to anchor the popup position
  show: boolean;                                         // Whether the popup is visible or not
  positionAbove?: boolean;                               // Optional flag if popup should show above the input instead of below
}

const MentionUserPopup: React.FC<MentionUserPopupProps> = ({
  users,
  query,
  onSelect,
  onClose,
  anchorRef,
  show,
  positionAbove,
}) => {
  // Reference to the popup DOM element for positioning calculations
  const popupRef = useRef<HTMLDivElement>(null);

  // State to track which user is currently selected in the list (for keyboard navigation & highlighting)
  const [selectedIdx, setSelectedIdx] = React.useState(0);

  // Effect to handle keyboard navigation and selection inside the popup
  useEffect(() => {
    if (!show) return; // If popup is not visible, do nothing

    // Reset selected index to 0 each time popup is shown
    setSelectedIdx(0);

    // Keyboard event handler to navigate/select items or close the popup
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!show) return; // Ignore if popup closed during event

      // Arrow Down key: move selection down but do not exceed last user index
      if (e.key === 'ArrowDown') {
        setSelectedIdx(idx => Math.min(idx + 1, users.length - 1));
        e.preventDefault(); // prevent scrolling the page etc
      }
      // Arrow Up key: move selection up but do not go below 0
      else if (e.key === 'ArrowUp') {
        setSelectedIdx(idx => Math.max(idx - 1, 0));
        e.preventDefault();
      }
      // Enter key: select the currently highlighted user and prevent default behavior (like submitting a form)
      else if (e.key === 'Enter') {
        if (users[selectedIdx]) {
          onSelect(users[selectedIdx]);
        }
        e.preventDefault();
      }
      // Escape key: close the popup and prevent default behavior
      else if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      }
    };

    // Attach event listener on document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup: remove listener when effect is cleaned up (on unmount or dependency change)
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, users, selectedIdx, onSelect, onClose]);

  // State for the inline style for the popup's position (left, top, width, etc)
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  // Effect to calculate positioning of the popup relative to the anchor input
  useEffect(() => {
    if (anchorRef.current && show) {
      const input = anchorRef.current;

      // Default position below the input (+4px spacing)
      let top = input.offsetTop + input.offsetHeight + 4;

      // If positionAbove is true and popup is mounted, show above input instead
      if (positionAbove && popupRef.current) {
        top = input.offsetTop - popupRef.current.offsetHeight - 4;
      }

      // Set inline style for absolute positioning of the popup
      setStyle({
        position: 'absolute',
        left: input.offsetLeft,
        top,
        minWidth: input.offsetWidth,
        zIndex: 1000,
      });
    }
  }, [anchorRef, show, positionAbove]);

  // If popup is not shown or there are no user suggestions, render nothing
  if (!show || users.length === 0) return null;

  return (
    <div
      ref={popupRef}
      style={{
        ...style,
        border: '1px solid #cbd5e1',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px #e0e0e0',
        minWidth: 180,
        zIndex: 2000,
        marginTop: 4,
      }}
      className="mention-user-popup"
    >
      {/* User suggestions list */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 220, overflowY: 'auto' }}>
        {users.map((user, idx) => (
          <li
            key={user.username}
            style={{
              padding: '8px 16px',
              background: idx === selectedIdx ? '#e0e7ff' : 'transparent',
              cursor: 'pointer',
              fontWeight: idx === selectedIdx ? 600 : 400,
            }}
            // Set the hovered item as selected so keyboard navigation syncs with mouseover
            onMouseEnter={() => setSelectedIdx(idx)}
            // Use onMouseDown instead of onClick to prevent input losing focus before onSelect fires
            onMouseDown={e => {
              e.preventDefault();
              onSelect(user);
            }}
          >
            @{user.username}
            {user.display_name ? (
              // Display optional display name beside username in lighter color
              <span style={{ color: '#888', marginLeft: 8 }}>{user.display_name}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MentionUserPopup;
