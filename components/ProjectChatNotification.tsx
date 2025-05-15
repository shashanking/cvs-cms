import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

interface ChatNotification {
  id: string;
  project_id: string;
  username: string;
  message: string;
  created_at: string;
}

const ProjectChatNotification = () => {
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;
  const [latestMsg, setLatestMsg] = useState<ChatNotification | null>(null);
  const [show, setShow] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !user) return;
    // Get last seen from localStorage
    const last = localStorage.getItem(`chat-last-seen-${projectId}-${user.username}`);
    setLastSeen(last);
    // Subscribe to real-time chat messages
    const subscription = supabase
      .channel('public:project_chat_notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_chat', filter: `project_id=eq.${projectId}` }, payload => {
        const msg = payload.new as ChatNotification;
        // Only show if not sent by self
        if (msg.username !== user.username) {
          setLatestMsg(msg);
          setShow(true);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [projectId, user]);

  const handleClose = () => {
    setShow(false);
    if (latestMsg) {
      localStorage.setItem(`chat-last-seen-${projectId}-${user.username}`, latestMsg.created_at);
      setLastSeen(latestMsg.created_at);
    }
  };

  if (!show || !latestMsg) return null;
  if (lastSeen && new Date(latestMsg.created_at) <= new Date(lastSeen)) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#2563eb', color: '#fff', borderRadius: 12, boxShadow: '0 4px 16px #2563eb55', padding: '18px 28px', zIndex: 1000, minWidth: 260 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>New chat message</div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{latestMsg.username}</div>
      <div style={{ margin: '4px 0 8px 0', fontSize: 15 }}>{latestMsg.message}</div>
      <div style={{ fontSize: 11, color: '#e0e0e0', marginBottom: 8 }}>{new Date(latestMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <button onClick={handleClose} style={{ background: '#fff', color: '#2563eb', border: 'none', borderRadius: 6, fontWeight: 600, padding: '6px 18px', fontSize: 14, cursor: 'pointer' }}>Dismiss</button>
    </div>
  );
};

export default ProjectChatNotification;
