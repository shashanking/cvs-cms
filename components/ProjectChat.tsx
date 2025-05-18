import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';
import MentionUserPopup from './MentionUserPopup';
import { FiSend, FiArrowLeft, FiPaperclip } from 'react-icons/fi';
import { formatDistanceToNowStrict } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  project_id: string;
  username: string;
  message: string;
  created_at: string;
  is_sending?: boolean;
  is_error?: boolean;
}

const ProjectChat = () => {
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<{ username: string, display_name?: string }[]>([]);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIdx, setMentionStartIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) return;

    let mounted = true;

    const fetchInitialData = async () => {
      try {
        setLoading(true);
        await fetchMessages();
        await fetchUsers();
      } catch (error) {
        console.error('Error initializing chat:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Track sent message IDs to prevent duplicates
    const sentMessageIds = new Set<string>();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`project_chat_${projectId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'project_chat',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;

        // If we've already processed this message (e.g., from our own send), skip it
        if (sentMessageIds.has(newMsg.id)) {
          return;
        }

        setMessages(prev => {
          // Check for duplicate messages by content and timestamp (within 1 second)
          const isDuplicate = prev.some(m => {
            if (m.id === newMsg.id) return true;

            // Check if this is a temporary message that matches the new message
            if (m.is_sending && m.message === newMsg.message && m.username === newMsg.username) {
              // Calculate time difference in seconds
              const timeDiff = Math.abs(
                (new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) / 1000
              );
              // If messages are very close in time, consider them duplicates
              return timeDiff < 5;
            }

            return false;
          });

          if (isDuplicate) {
            // Replace temporary message with the real one
            return prev.map(m => {
              if (m.is_sending && m.message === newMsg.message && m.username === newMsg.username) {
                return newMsg;
              }
              return m;
            });
          }

          return [...prev, newMsg];
        });

        scrollToBottom();
      })
      .subscribe();

    // Initialize data once subscription is ready
    fetchInitialData().catch(err => {
      console.error('Error initializing chat data:', err);
    });

    // Expose the sentMessageIds to window for debugging
    (window as any).sentMessageIds = sentMessageIds;

    return () => {
      mounted = false;
      supabase.removeChannel(subscription);
      sentMessageIds.clear();
    };
  }, [projectId]);

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('username, display_name');
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMessages = async () => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from('project_chat')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Remove any temporary messages that might be in the UI
      setMessages(messages => {
        const realMessages = data || [];
        const tempMessages = messages.filter(m => m.is_sending && !realMessages.some(rm => rm.message === m.message));
        return [...realMessages, ...tempMessages];
      });

      setLoading(false);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    if (!messageText || !user || !projectId) return;

    // Create temporary message for immediate feedback
    const tempId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      project_id: projectId,
      username: user.username,
      message: messageText,
      created_at: new Date().toISOString(),
      is_sending: true
    };

    // Add temporary message to the UI
    setMessages(prev => [...prev, tempMessage]);
    setInput('');
    scrollToBottom();

    try {
      // Send chat message
      const { data: messageData, error: messageError } = await supabase.from('project_chat').insert([
        {
          project_id: projectId,
          username: user.username,
          message: messageText,
        },
      ]).select();

      if (messageError) throw messageError;

      // Add the real message ID to our tracking set to prevent duplicates
      if (messageData && messageData[0]) {
        // Access the sentMessageIds from window for now (not ideal but works for this fix)
        const sentIds = (window as any).sentMessageIds;
        if (sentIds && typeof sentIds.add === 'function') {
          sentIds.add(messageData[0].id);
        }

        // Replace the temporary message with the real one
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId ? { ...messageData[0], is_sending: false } : m
          )
        );
      }

      // Mention detection: extract @usernames
      const mentionPattern = /@([a-zA-Z0-9_]+)/g;
      const mentioned = Array.from(messageText.matchAll(mentionPattern)).map(m => m[1]);

      if (mentioned.length > 0 && projectId) {
        // Fetch all users (members and founders)
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('username');
        if (usersError) {
          console.error('Error fetching users:', usersError);
        }
        const allUsernames = (users || []).map((u: any) => u.username);

        // For each valid mention, insert notification (skip self-mention)
        for (const username of mentioned) {
          if (username !== user.username && allUsernames.includes(username)) {
            const { error: notifError } = await supabase.from('chat_notifications').insert([
              {
                project_id: projectId,
                mentioned_by: user.username,
                mentioned_user: username,
                message: messageText,
                message_id: messageData && messageData[0] ? messageData[0].id : null,
              },
            ]);
            if (notifError) {
              console.error('Notification insert error for', username, notifError);
            }
          }
        }
      }

      // Remove temporary message once the real one arrives via realtime
      // This will happen automatically when the subscription receives the new message

    } catch (error) {
      console.error('Error sending message:', error);

      // Update the temporary message to show error state
      setMessages(prev =>
        prev.map(m =>
          m.id === tempId ? { ...m, is_sending: false, is_error: true } : m
        )
      );
    }
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }, []);

  // Format message time
  const formatTime = (dateString: string) => {
    return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true });
  };

  // Parse message for mentions and format them
  const parseMessage = useCallback((message: string) => {
    if (!message) return '';
    // Simple mention highlighting - in a real app, you'd want to handle this more robustly
    return message.replace(/@(\w+)/g, (match, username) => {
      return `<span class="mention">@${username}</span>`;
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center">
          <button
            onClick={() => window.history.back()}
            className="md:hidden mr-3 p-2 rounded-full hover:bg-gray-100"
            aria-label="Back to project"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Project Chat</h1>
        </div>
      </div>

      {/* Messages - Scrollable area */}
      <div className="flex-1 overflow-y-auto p-4 px-5 md:px-6 pb-32 chat-container chat-scrollbar" ref={messagesContainerRef}>
        <div className="max-w-3xl mx-auto w-full flex flex-col space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-pulse text-gray-500">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No messages yet. Be the first to say hi! 👋
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m, index) => {
                const isCurrentUser = m.username === user?.username;
                const showHeader = index === 0 || messages[index - 1]?.username !== m.username;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-3 group`}
                  >
                    {/* Avatar for other users */}
                    {!isCurrentUser && showHeader && (
                      <div className="flex-shrink-0 mr-2 self-end mb-1">
                        <div className="chat-avatar chat-avatar-receiver">
                          {m.username.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col max-w-[85%]">
                      {/* Username for other users */}
                      {!isCurrentUser && showHeader && (
                        <div className="text-xs font-medium text-gray-500 mb-1 ml-1">
                          {m.username}
                        </div>
                      )}

                      <div
                        className={`chat-bubble ${isCurrentUser
                            ? 'chat-bubble-sender'
                            : 'chat-bubble-receiver'
                          } ${m.is_sending ? 'opacity-70' : ''}`}
                      >
                        <div
                          className="text-sm break-words leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: parseMessage(m.message) }}
                        />

                        <div className="flex items-center justify-end mt-1 message-time">
                          <span>
                            {formatTime(m.created_at)}
                          </span>
                          {isCurrentUser && !m.is_sending && (
                            <span className="ml-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </span>
                          )}
                          {isCurrentUser && m.is_sending && (
                            <span className="ml-1 animate-pulse">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Show timestamp on hover for mobile */}
                      <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 md:hidden">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Avatar for current user */}
                    {isCurrentUser && showHeader && (
                      <div className="flex-shrink-0 ml-2 self-end mb-1">
                        <div className="chat-avatar chat-avatar-sender">
                          {m.username.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </AnimatePresence>
          )}
        </div>
      </div>
      {/* Message Input - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg chat-input-container">
        <form 
          onSubmit={handleSend} 
          className="max-w-3xl mx-auto w-full p-4 px-5 md:px-6"
        >
          <div className="flex flex-row items-center gap-2 w-full max-w-full">
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
              onKeyDown={(e) => {
                // Handle Enter key for sending message (Shift+Enter for new line)
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Type a message..."
              className="flex-grow min-w-0 px-4 py-4 text-base md:text-lg border-0 bg-gray-50 rounded-full focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all duration-200 shadow-inner"
              autoComplete="off"
              aria-label="Type your message"
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
            <button 
              type="submit" 
              disabled={!input.trim()} 
              className={`flex-shrink-0 p-4 ml-1 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200 text-lg ${
                input.trim() 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-md' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              aria-label="Send message"
            >
              <FiSend className="w-6 h-6" />
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2 text-center opacity-70 font-medium">
            Press Enter to send, Shift+Enter for new line
          </div>
        </form>
        <div className="h-4 md:h-0"></div>
      </div>
    </div>
  );
}

export default ProjectChat;
