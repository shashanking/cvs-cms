import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

interface ChatMessage {
  id: string;
  project_id: string;
  username: string;
  message: string;
  created_at: string;
}

const ProjectChat = () => {
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetchMessages();
    // Subscribe to realtime INSERT updates only
    const subscription = supabase
      .channel('public:project_chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_chat', filter: `project_id=eq.${projectId}` }, payload => {
        const newMsg = payload.new as ChatMessage;
        setMessages(prev => {
          // Avoid duplicate
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        scrollToBottom();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
    // eslint-disable-next-line
  }, [projectId]);

  const fetchMessages = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from('project_chat')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
    scrollToBottom();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !projectId) return;
    await supabase.from('project_chat').insert([
      {
        project_id: projectId,
        username: user.username,
        message: input.trim(),
      },
    ]);
    setInput('');
    // fetchMessages will be triggered by realtime
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div style={{ border: '1.5px solid #c3dafc', borderRadius: 12, background: '#f8fafc', maxWidth: 480, minHeight: 320, display: 'flex', flexDirection: 'column', height: 400 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? <div>Loading chat...</div> : messages.length === 0 ? <div style={{ color: '#888' }}>No messages yet.</div> : messages.map(m => (
          <div key={m.id} style={{ alignSelf: m.username === user?.username ? 'flex-end' : 'flex-start', background: m.username === user?.username ? '#dbeafe' : '#fff', borderRadius: 8, padding: '8px 12px', maxWidth: '85%', boxShadow: '0 1px 4px #e3e3e3', fontSize: 15 }}>
            <span style={{ fontWeight: 600, color: '#2563eb', fontSize: 13 }}>{m.username}</span>
            <span style={{ marginLeft: 8, color: '#888', fontSize: 11 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div style={{ marginTop: 2 }}>{m.message}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', padding: 12, borderTop: '1px solid #e5e7eb', background: '#f1f5f9' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15 }}
        />
        <button type="submit" disabled={!input.trim()} style={{ marginLeft: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Send</button>
      </form>
    </div>
  );
};

export default ProjectChat;
