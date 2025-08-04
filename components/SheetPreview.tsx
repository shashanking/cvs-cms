import React, { useState } from 'react';

interface SheetPreviewProps {
  url: string;
  name?: string;
}

export default function SheetPreview({ url, name }: SheetPreviewProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = match ? match[1] : null;
  const embedUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/preview` : null;

  if (!embedUrl) return <div style={{ color: 'red' }}>Invalid Google Sheet link.</div>;

  return (
    <div style={{ minHeight: 360, marginTop: 12, position: 'relative' }}>
      {name && <div style={{ fontWeight: 600, marginBottom: 6 }}>{name}</div>}
      <iframe
        src={embedUrl}
        title={name || 'Sheet Preview'}
        width="100%"
        height={320}
        style={{ border: '1.5px solid #e3e7ef', borderRadius: 8 }}
        frameBorder={0}
        allowFullScreen={false}
      />
      <button
        onClick={() => setFullscreen(true)}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '6px 12px',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
      >
        Full Screen
      </button>

      {fullscreen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.7)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <button
            onClick={() => setFullscreen(false)}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: 32,
              cursor: 'pointer',
            }}
            aria-label="Close"
          >
            &times;
          </button>
          <iframe
            src={embedUrl}
            title={name || 'Sheet Fullscreen'}
            width="90vw"
            height="90vh"
            frameBorder={0}
            style={{ borderRadius: 8 }}
            allowFullScreen={false}
          />
        </div>
      )}
    </div>
  );
}
