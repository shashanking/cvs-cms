import React, { useEffect, useState } from 'react';
// Import supabase client instance for real-time and REST queries
import { supabase } from '../lib/supabaseClient';
// Custom hook to access current user context
import { useUser } from './UserContext';
// Custom hook to access current project context
import { useProject } from './ProjectContext';

// Define the shape of a chat notification message
interface ChatNotification {
  id: string;
  project_id: string;
  username: string;
  message: string;
  created_at: string;
}

const ProjectChatNotification = () => {
  // Obtain current user and project info from context hooks
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;

  // State to hold the latest chat message that has arrived
  const [latestMsg, setLatestMsg] = useState<ChatNotification | null>(null);

  // State to control display of the notification popup
  const [show, setShow] = useState(false);

  // Track the timestamp of the last message seen by user (persisted in localStorage)
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  // Set up effect to subscribe to new chat messages in the current project
  useEffect(() => {
    // Guard clause: do nothing if project or user is not yet available
    if (!projectId || !user) return;

    // Retrieve last seen timestamp from localStorage for this project-user combo
    const last = localStorage.getItem(`chat-last-seen-${projectId}-${user.username}`);
    // Update state with last seen timestamp so we can compare incoming messages
    setLastSeen(last);

    // Set up realtime subscription to listen for new INSERT events in project_chat table filtered by project_id
    const subscription = supabase
      .channel('public:project_chat_notify') // channel name for chat notifications
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_chat', filter: `project_id=eq.${projectId}` },
        (payload) => {
          // When a new message is inserted, cast payload to ChatNotification type
          const msg = payload.new as ChatNotification;

          // Show notification only if the message is not from the current user (no self-notifications)
          if (msg.username !== user.username) {
            // Store the latest incoming message in state
            setLatestMsg(msg);
            // Show the notification popup
            setShow(true);
          }
        }
      )
      .subscribe();

    // Clean up subscription on unmount or if projectId/user changes
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [projectId, user]);

  // Handler for when user clicks "Dismiss" button on the notification
  const handleClose = () => {
    setShow(false); // Hide notification popup

    if (latestMsg) {
      // Save the timestamp of the latest seen message in localStorage for persistence
      localStorage.setItem(`chat-last-seen-${projectId}-${user.username}`, latestMsg.created_at);
      setLastSeen(latestMsg.created_at); // Update state to reflect last seen
    }
  };

  // If no notification to show or popup is hidden, render nothing
  if (!show || !latestMsg) return null;

  // If the latest message was sent before or at last seen timestamp, no need to show notification
  if (lastSeen && new Date(latestMsg.created_at) <= new Date(lastSeen)) return null;

  // Render the notification popup box showing latest new chat message
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,                // 24px from bottom viewport edge
        right: 24,                 // 24px from right viewport edge
        background: '#2563eb',     // Blue background color
        color: '#fff',             // White text
        borderRadius: 12,          // Rounded corners
        boxShadow: '0 4px 16px #2563eb55', // Soft blue shadow for elevation
        padding: '18px 28px',
        zIndex: 1000,              // Ensure popup is on top of other UI elements
        minWidth: 260,             // Minimum width for sufficient content space
      }}
    >
      {/* Notification heading */}
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>New chat message</div>
      {/* Username of the message sender */}
      <div style={{ fontWeight: 600, fontSize: 14 }}>{latestMsg.username}</div>
      {/* Message text preview */}
      <div style={{ margin: '4px 0 8px 0', fontSize: 15 }}>{latestMsg.message}</div>
      {/* Message timestamp */}
      <div style={{ fontSize: 11, color: '#e0e0e0', marginBottom: 8 }}>
        {new Date(latestMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      {/* Dismiss button to close popup */}
      <button
        onClick={handleClose}
        style={{
          background: '#fff',
          color: '#2563eb',
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          padding: '6px 18px',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  );
};

export default ProjectChatNotification;
