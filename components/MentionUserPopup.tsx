import React, { useEffect, useRef } from 'react';

interface MentionUserPopupProps {
  users: { username: string; display_name?: string }[];
  query: string;
  onSelect: (user: { username: string; display_name?: string }) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLInputElement>;
  show: boolean;
  positionAbove?: boolean;
}

const MentionUserPopup: React.FC<MentionUserPopupProps> = ({ users, query, onSelect, onClose, anchorRef, show, positionAbove }) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [selectedIdx, setSelectedIdx] = React.useState(0);

  useEffect(() => {
    if (!show) return;
    setSelectedIdx(0);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!show) return;
      if (e.key === 'ArrowDown') {
        setSelectedIdx(idx => Math.min(idx + 1, users.length - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIdx(idx => Math.max(idx - 1, 0));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (users[selectedIdx]) {
          onSelect(users[selectedIdx]);
        }
        e.preventDefault();
      } else if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, users, selectedIdx, onSelect, onClose]);

  // Position popup below input
  const [style, setStyle] = React.useState<React.CSSProperties>({});
  useEffect(() => {
    if (anchorRef.current && show) {
      const input = anchorRef.current;
      let top = input.offsetTop + input.offsetHeight + 4;
      if (positionAbove && popupRef.current) {
        top = input.offsetTop - popupRef.current.offsetHeight - 4;
      }
      setStyle({
        position: 'absolute',
        left: input.offsetLeft,
        top,
        minWidth: input.offsetWidth,
        zIndex: 1000,
      });
    }
  }, [anchorRef, show, positionAbove]);

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
            onMouseEnter={() => setSelectedIdx(idx)}
            onMouseDown={e => {
              e.preventDefault();
              onSelect(user);
            }}
          >
            @{user.username}
            {user.display_name ? (
              <span style={{ color: '#888', marginLeft: 8 }}>{user.display_name}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MentionUserPopup;
