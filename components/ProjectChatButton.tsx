import React from 'react';
import { FiMessageSquare } from 'react-icons/fi';
import { useRouter } from 'next/router';
import { useProject } from './ProjectContext';

const ProjectChatButton = () => {
  const router = useRouter();
  const { project } = useProject();
  const projectId = project?.id;

  const handleClick = () => {
    if (projectId) {
      router.push(`/project/${projectId}/chat`);
    }
  };

  return (
    <button
      aria-label="Open group chat"
      onClick={handleClick}
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
      disabled={!projectId}
    >
      <FiMessageSquare />
      {/* Optionally show unread badge here */}
    </button>
  );
};

export default ProjectChatButton;
