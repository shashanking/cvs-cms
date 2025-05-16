import React, { useState } from 'react';
import FullScreenModal from './FullScreenModal';

interface SheetPreviewProps {
  url: string;
  name?: string;
  onOpen?: () => void;
  onClose?: () => void;
}

const SheetPreview: React.FC<SheetPreviewProps> = ({ url, name, onOpen, onClose }) => {
  const [fullscreen, setFullscreen] = useState(false);
  // Extract the Sheet ID and construct the embed URL
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = match ? match[1] : null;
  const embedUrl = sheetId
    ? `https://docs.google.com/spreadsheets/d/${sheetId}/preview`
    : null;

  if (!embedUrl) {
    return <div style={{ color: 'red', fontWeight: 500 }}>Invalid Google Sheet link.</div>;
  }

  const handleOpen = () => {
    setFullscreen(true);
    if (onOpen) onOpen();
  };
  const handleClose = () => {
    setFullscreen(false);
    if (onClose) onClose();
  };

  return (
    <div style={{ width: '100%', minHeight: 400, margin: '10px 0', position: 'relative' }}>
      {name && <div style={{ fontWeight: 600, marginBottom: 6 }}>{name}</div>}
      <iframe
        src={embedUrl}
        title={name || 'Google Sheet Preview'}
        width="100%"
        height="320"
        frameBorder="0"
        style={{ border: '1.5px solid #e3e7ef', borderRadius: 8 }}
        allowFullScreen={false}
      />
      <button onClick={handleOpen} style={{ position: 'absolute', top: 8, right: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Full Screen</button>
      <FullScreenModal open={fullscreen} onClose={handleClose}>
        <iframe
          src={embedUrl}
          title={name || 'Google Sheet Full Screen'}
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 'none', borderRadius: 8 }}
          allowFullScreen={false}
        />
      </FullScreenModal>
    </div>
  );
};

export default SheetPreview;
