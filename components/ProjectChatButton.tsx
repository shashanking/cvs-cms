import React from 'react';
// Import chat icon from react-icons
import { FiMessageSquare } from 'react-icons/fi';
// Next.js router for navigation
import { useRouter } from 'next/router';
// Custom project context hook to get current project info
import { useProject } from './ProjectContext';

const ProjectChatButton = () => {
  // Get Next.js router instance
  const router = useRouter();
  // Get current project from context
  const { project } = useProject();
  // Extract projectId from project (may be undefined if no project selected)
  const projectId = project?.id;

  // Click handler to navigate to current project's chat page
  const handleClick = () => {
    if (projectId) {
      // Navigate to /project/[projectId]/chat
      router.push(`/project/${projectId}/chat`);
    }
  };

  return (
    // A fixed-position button at bottom-right corner of the viewport
    <button
      aria-label="Open group chat"   // Accessible label for screen readers
      onClick={handleClick}           // Handle click event to navigate
      style={{
        position: 'fixed',            // Fixed in viewport
        bottom: 24,                  // 24px from bottom edge
        right: 24,                   // 24px from right edge
        zIndex: 1100,                // Ensure it stays above most other elements
        background: '#2563eb',       // Blue background
        color: '#fff',               // White icon color
        border: 'none',              // Remove default border
        borderRadius: '50%',         // Circular button
        width: 60,                   // 60px wide
        height: 60,                  // 60px tall (perfect circle)
        boxShadow: '0 4px 16px #2563eb44', // Subtle blue shadow with transparency
        display: 'flex',             // Flex to center icon
        alignItems: 'center',        // Vertically center icon
        justifyContent: 'center',    // Horizontally center icon
        fontSize: 32,                // Large icon size
        cursor: 'pointer',           // Pointer cursor to indicate clickable
        transition: 'background 0.2s', // Smooth background color transition on hover (can add hover styles separately)
        outline: 'none',             // Remove focus outline for custom styling (consider accessibility)
      }}
      // Disable button if no projectId is available (can't navigate)
      disabled={!projectId}
    >
      {/* Render chat icon */}
      <FiMessageSquare />
      {/* You may add an unread badge here dynamically if needed */}
    </button>
  );
};

export default ProjectChatButton;
