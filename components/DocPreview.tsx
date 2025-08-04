// Import React and useState hook for managing component state
import React, { useState } from 'react';
// Import a custom FullScreenModal component that shows content in fullscreen modal overlay
import FullScreenModal from './FullScreenModal';

// Define TypeScript interface for component props
interface DocPreviewProps {
  url: string;            // URL of the Google Doc to preview
  name?: string;          // Optional display name/title for the doc
  onOpen?: () => void;    // Optional callback invoked when fullscreen opens
  onClose?: () => void;   // Optional callback invoked when fullscreen closes
}

// Define a React Functional Component with the defined props type
const DocPreview: React.FC<DocPreviewProps> = ({ url, name, onOpen, onClose }) => {
  // State to track whether fullscreen preview modal is open
  const [fullscreen, setFullscreen] = useState(false);

  // Extract Google Doc ID from the URL by matching pattern
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);

  // Retrieve the document ID from match result or null if not found
  const docId = match ? match[1] : null;

  // Construct the Google Docs embed preview URL using the extracted doc ID
  const embedUrl = docId
    ? `https://docs.google.com/document/d/${docId}/preview`
    : null;

  // If no valid embed URL could be constructed, display error message and exit early
  if (!embedUrl) {
    return <div style={{ color: 'red', fontWeight: 500 }}>Invalid Google Doc link.</div>;
  }

  // Define handler for opening fullscreen modal: toggle state and call onOpen callback if provided
  const handleOpen = () => {
    setFullscreen(true);
    if (onOpen) onOpen();
  };

  // Define handler for closing fullscreen modal: toggle state and call onClose callback if provided
  const handleClose = () => {
    setFullscreen(false);
    if (onClose) onClose();
  };

  // Render the component UI
  return (
    // Outer container with fixed minimum height, relative position for positioning fullscreen button
    <div style={{ width: '100%', minHeight: 400, margin: '10px 0', position: 'relative' }}>

      {/* Show document name/title above preview if provided */}
      {name && <div style={{ fontWeight: 600, marginBottom: 6 }}>{name}</div>}

      {/* Embedded preview iframe of Google Doc preview URL */}
      <iframe
        src={embedUrl}
        title={name || 'Google Doc Preview'}
        width="100%"
        height="320"
        frameBorder="0"
        style={{ border: '1.5px solid #e3e7ef', borderRadius: 8 }}
        allowFullScreen={false}  // No fullscreen allowed directly on this iframe
      />

      {/* Button to open fullscreen modal */}
      <button
        onClick={handleOpen}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '4px 12px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Full Screen
      </button>

      {/* Fullscreen modal wrapper, controlled by fullscreen state */}
      <FullScreenModal open={fullscreen} onClose={handleClose}>

        {/* Embedded iframe inside fullscreen modal, fills available space */}
        <iframe
          src={embedUrl}
          title={name || 'Google Doc Full Screen'}
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 'none', borderRadius: 8 }}
          allowFullScreen={false} // Again, no fullscreen on iframe itself (handled by modal)
        />
      </FullScreenModal>
    </div>
  );
};

// Export the component as the default export of this module
export default DocPreview;
