import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';
import MentionUserPopup from './MentionUserPopup';

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
  const [members, setMembers] = useState<{username: string, display_name?: string}[]>([]);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIdx, setMentionStartIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    // Fetch all users for mention popup
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('username, display_name');
      setMembers(data || []);
    };
    fetchUsers();
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
  // DEBUG: Log input and user
  console.log('handleSend called. Input:', input, 'User:', user, 'ProjectId:', projectId);
    e.preventDefault();
    if (!input.trim() || !user || !projectId) return;

    // Send chat message
    const { data: messageData, error: messageError } = await supabase.from('project_chat').insert([
      {
        project_id: projectId,
        username: user.username,
        message: input.trim(),
      },
    ]).select();

    // Mention detection: extract @usernames
    const mentionPattern = /@([a-zA-Z0-9_]+)/g;
    const mentioned = Array.from(input.matchAll(mentionPattern)).map(m => m[1]);
    console.log('Mentioned usernames:', mentioned);

    if (mentioned.length > 0 && projectId) {
      // Fetch all users (members and founders)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('username');
      if (usersError) {
        console.error('Error fetching users:', usersError);
      }
      const allUsernames = (users || []).map((u: any) => u.username);
      console.log('All system usernames:', allUsernames);
      // For each valid mention, insert notification (skip self-mention)
      for (const username of mentioned) {
        if (username !== user.username && allUsernames.includes(username)) {
          const { error: notifError } = await supabase.from('chat_notifications').insert([
            {
              project_id: projectId,
              mentioned_by: user.username,
              mentioned_user: username,
              message: input.trim(),
              message_id: messageData && messageData[0] ? messageData[0].id : null,
            },
          ]);
          if (notifError) {
            console.error('Notification insert error for', username, notifError);
          } else {
            console.log('Notification inserted for', username);
          }
        } else {
          if (username === user.username) {
            console.log('Skipping self-mention for', username);
          } else if (!allUsernames.includes(username)) {
            console.warn('Mentioned username not found in users table:', username);
          }
        }
      }
    }
    setInput('');
    // fetchMessages will be triggered by realtime
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#f8fafc' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 700, margin: '0 auto', width: '100%' }}>
        {loading ? <div>Loading chat...</div> : messages.length === 0 ? <div style={{ color: '#888' }}>No messages yet.</div> : messages.map(m => (
          <div key={m.id} style={{ alignSelf: m.username === user?.username ? 'flex-end' : 'flex-start', background: m.username === user?.username ? '#dbeafe' : '#fff', borderRadius: 8, padding: '8px 12px', maxWidth: '85%', boxShadow: '0 1px 4px #e3e3e3', fontSize: 15 }}>
            <span style={{ fontWeight: 600, color: '#2563eb', fontSize: 13 }}>{m.username}</span>
            <span style={{ marginLeft: 8, color: '#888', fontSize: 11 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div style={{ marginTop: 2 }}>{m.message}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', padding: '18px 0', borderTop: '1px solid #e5e7eb', background: '#f8fafc', maxWidth: 700, margin: '0 auto', width: '100%' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => {
              const val = e.target.value;
              setInput(val);
              const caret = e.target.selectionStart || val.length;
              // Find last @ before caret
              const lastAt = val.lastIndexOf('@', caret - 1);
              if (lastAt !== -1 && (lastAt === 0 || /\s/.test(val[lastAt - 1]))) {
                // Find the query after @
                const query = val.slice(lastAt + 1, caret);
                setMentionQuery(query);
                setMentionStartIdx(lastAt);
                setShowMentionPopup(true);
              } else {
                setShowMentionPopup(false);
                setMentionQuery('');
                setMentionStartIdx(null);
              }
            }}
            placeholder="Type a message..."
            style={{ flex: 1, padding: 12, borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 16, background: '#fff', boxShadow: '0 1px 4px #e5e7eb22' }}
            autoComplete="off"
          />
          <MentionUserPopup
            users={members.filter(m => m.username !== user?.username && m.username.toLowerCase().includes((mentionQuery || '').toLowerCase()))}
            query={mentionQuery}
            show={showMentionPopup}
            anchorRef={inputRef}
            positionAbove={true}
            onSelect={selectedUser => {
              if (inputRef.current && mentionStartIdx !== null) {
                const caret = inputRef.current.selectionStart || input.length;
                const before = input.slice(0, mentionStartIdx);
                const after = input.slice(caret);
                const insert = `@${selectedUser.username} `;
                setInput(before + insert + after);
                setShowMentionPopup(false);
                setMentionQuery('');
                setMentionStartIdx(null);
                setTimeout(() => {
                  inputRef.current?.focus();
                  inputRef.current?.setSelectionRange((before + insert).length, (before + insert).length);
                }, 0);
              }
            }}
            onClose={() => {
              setShowMentionPopup(false);
              setMentionQuery('');
              setMentionStartIdx(null);
            }}
          />
        </div>
        <button type="submit" disabled={!input.trim()} style={{ marginLeft: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Send</button>
      </form>
    </div>
  );
}

export default ProjectChat;
