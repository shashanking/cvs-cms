import React from 'react';

// Props definition for the modal component
interface FullScreenModalProps {
  open: boolean;             // Controls whether the modal is shown or hidden
  onClose: () => void;       // Callback triggered when modal is requested to close
  children: React.ReactNode; // The content to render inside the modal
}

// React functional component for a fullscreen modal dialog
const FullScreenModal: React.FC<FullScreenModalProps> = ({ open, onClose, children }) => {
  // If 'open' is false, render nothing (null) to hide the modal
  if (!open) return null;

  return (
    // Overlay covering the entire viewport with semi-transparent background
    <div
      style={{
        position: 'fixed',          // Fixed to viewport, regardless of scroll
        top: 0,                    // Cover entire height/width
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.7)', // Dark semi-transparent background
        zIndex: 2000,              // High z-index to overlay other elements
        display: 'flex',           // Flex layout to center modal content
        alignItems: 'center',
        justifyContent: 'center',
      }}
      // Consider adding role and aria attributes here for accessibility
      role="dialog"
      aria-modal="true"
    >
      {/* Modal content container */}
      <div
        style={{
          background: '#fff',        // White background for modal content
          borderRadius: 10,          // Rounded corners
          width: '90vw',             // Responsive width and height
          height: '90vh',
          boxShadow: '0 4px 32px #0003', // Subtle shadow for depth
          position: 'relative',      // To position close button absolutely inside
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Close button positioned at the top-right corner */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 20,
            background: 'none',
            border: 'none',
            fontSize: 32,
            color: '#2563eb',
            cursor: 'pointer',
            zIndex: 2,               // Ensures button is above other content
            lineHeight: 1,
          }}
          aria-label="Close modal"   // Accessibility label for screen readers
        >
          &times;                     {/* Unicode multiplication sign (×) as close icon */}
        </button>

        {/* Scrollable container for the modal content */}
        <div
          style={{
            flex: 1,                 // Take up remaining vertical space
            overflow: 'auto',        // Scroll if content is too large
            borderRadius: 8,         // Slight rounding on content edges
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default FullScreenModal;
