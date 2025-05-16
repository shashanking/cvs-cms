import React from 'react';

interface FullScreenModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const FullScreenModal: React.FC<FullScreenModalProps> = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.7)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 10,
        width: '90vw',
        height: '90vh',
        boxShadow: '0 4px 32px #0003',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 20, background: 'none', border: 'none', fontSize: 32, color: '#2563eb', cursor: 'pointer', zIndex: 2 }}>&times;</button>
        <div style={{ flex: 1, overflow: 'auto', borderRadius: 8 }}>{children}</div>
      </div>
    </div>
  );
};

export default FullScreenModal;
