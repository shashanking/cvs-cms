import React, { useState } from 'react';
import { FiMessageSquare } from 'react-icons/fi';
import ProjectChat from './ProjectChat';

const ProjectChatButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Open group chat"
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1100,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 60,
          height: 60,
          boxShadow: '0 4px 16px #2563eb44',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          cursor: 'pointer',
          transition: 'background 0.2s',
          outline: 'none',
        }}
      >
        <FiMessageSquare />
        <span style={{ position: 'absolute', top: 8, right: 12, background: '#f87171', color: '#fff', borderRadius: '50%', fontSize: 11, padding: '2px 7px', fontWeight: 700, display: 'none' /* TODO: show unread badge */ }}>●</span>
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 92,
            right: 12,
            zIndex: 1101,
            maxWidth: '95vw',
            width: 380,
            boxShadow: '0 8px 32px #2563eb33',
            borderRadius: 18,
            background: '#fff',
            overflow: 'hidden',
            transition: 'all 0.2s',
          }}
        >
          <ProjectChat />
        </div>
      )}
    </>
  );
};

export default ProjectChatButton;
