import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';
import MentionUserPopup from './MentionUserPopup';
import { FiSend, FiArrowLeft } from 'react-icons/fi';
import { formatDistanceToNowStrict } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Define the structure of a chat message
interface ChatMessage {
  id: string;
  project_id: string;
  username: string;
  message: string;
  created_at: string;
  is_sending?: boolean; // Flag for temporary messages in UI
  is_error?: boolean;   // Flag for messages that failed to send
}

const ProjectChat = () => {
  const { user } = useUser(); // Get current logged-in user from context
  const { project } = useProject(); // Get current project from context
  const projectId = project?.id;

  // State for all messages in current project chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // State for input text box
  const [input, setInput] = useState('');
  // Loading flag while messages/users are being fetched
  const [loading, setLoading] = useState(false);
  // List of project members to support mentions
  const [members, setMembers] = useState<{ username: string; display_name?: string }[]>([]);
  // Whether to show the mention popup UI
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  // Current mention query after '@' (e.g. '@jo' -> 'jo')
  const [mentionQuery, setMentionQuery] = useState('');
  // Start index of the '@' mention in input text
  const [mentionStartIdx, setMentionStartIdx] = useState<number | null>(null);

  // Ref to the input element for focus and selection manipulation
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref to the last message element for automatic scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Ref to the scroll container of messages
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // useEffect to subscribe to real-time messages & fetch initial data on projectId change
  useEffect(() => {
    if (!projectId) return; // Skip if no project

    let mounted = true;

    // Fetch initial messages and user list
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

    // Track messages we sent locally to ignore duplicates from realtime subscription
    const sentMessageIds = new Set<string>();

    // Setup Supabase realtime subscription for new chat messages in this project
    const subscription = supabase
      .channel(`project_chat_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_chat',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Ignore messages we already processed (to prevent duplicates)
          if (sentMessageIds.has(newMsg.id)) {
            return;
          }

          setMessages((prev) => {
            // Prevent duplicate messages by:
            // - Checking for matching message id OR
            // - Checking for temporary messages with same content and username within 5 seconds
            const isDuplicate = prev.some((m) => {
              if (m.id === newMsg.id) return true;

              if (m.is_sending && m.message === newMsg.message && m.username === newMsg.username) {
                const timeDiff = Math.abs(
                  (new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) / 1000
                );
                return timeDiff < 5; // duplicate if very close in time
              }
              return false;
            });

            if (isDuplicate) {
              // Replace the temporary message with the real one
              return prev.map((m) => {
                if (m.is_sending && m.message === newMsg.message && m.username === newMsg.username) {
                  return newMsg; // replace temp with confirmed
                }
                return m;
              });
            }

            // Otherwise append new message normally
            return [...prev, newMsg];
          });

          // Auto-scroll chat to bottom
          scrollToBottom();
        }
      )
      .subscribe();

    // Fetch initial messages & users
    fetchInitialData().catch((err) => {
      console.error('Error initializing chat data:', err);
    });

    // For debugging, expose sentMessageIds set globally
    (window as any).sentMessageIds = sentMessageIds;

    // Cleanup function, unsubscribe and mark component unmounted
    return () => {
      mounted = false;
      supabase.removeChannel(subscription);
      sentMessageIds.clear();
    };
  }, [projectId]);

  // Fetch project members/users for mention suggestions
  const fetchUsers = async () => {
    try {
      const { data } = await supabase.from('users').select('username, display_name');
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Fetch chat messages for current project from Supabase
  const fetchMessages = async () => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from('project_chat')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Preserve any temporary messages not yet confirmed by server
      setMessages((messages) => {
        const realMessages = data || [];
        const tempMessages = messages.filter(
          (m) => m.is_sending && !realMessages.some((rm) => rm.message === m.message)
        );
        return [...realMessages, ...tempMessages];
      });

      setLoading(false);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  };

  // Handler to send a new chat message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    const messageText = input.trim();
    if (!messageText || !user || !projectId) return;

    // Create a temporary message with random temp id for immediate UI feedback
    const tempId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      project_id: projectId,
      username: user.username,
      message: messageText,
      created_at: new Date().toISOString(),
      is_sending: true,
    };

    // Optimistically add temp message to UI & clear input
    setMessages((prev) => [...prev, tempMessage]);
    setInput('');
    scrollToBottom();

    try {
      // Insert the message in Supabase database
      const { data: messageData, error: messageError } = await supabase
        .from('project_chat')
        .insert([
          {
            project_id: projectId,
            username: user.username,
            message: messageText,
          },
        ])
        .select();

      if (messageError) throw messageError;

      if (messageData && messageData[0]) {
        // Add sent message ID to tracking set to suppress duplicate from subscription
        const sentIds = (window as any).sentMessageIds;
        if (sentIds && typeof sentIds.add === 'function') {
          sentIds.add(messageData[0].id);
        }

        // Replace temp message with the real one from database + clear sending flag
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...messageData[0], is_sending: false } : m))
        );
      }

      // Detect mentions in message text with regex pattern
      const mentionPattern = /@([a-zA-Z0-9_]+)/g;
      const mentioned = Array.from(messageText.matchAll(mentionPattern)).map((m) => m[1]);

      if (mentioned.length > 0 && projectId) {
        // Fetch all valid usernames from users table
        const { data: users, error: usersError } = await supabase.from('users').select('username');
        if (usersError) {
          console.error('Error fetching users:', usersError);
        }
        const allUsernames = (users || []).map((u: any) => u.username);

        // Insert chat mention notifications for valid and non-self usernames
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
      // No need to remove temp message manually; subscription will handle the real message replacement
    } catch (error) {
      console.error('Error sending message:', error);

      // On error, mark the temp message with error flag and remove sending flag
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, is_sending: false, is_error: true } : m
        )
      );
    }
  };

  // Scroll smoothly to the bottom of the messages list
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }, []);

  // Format message date string to relative time, e.g., "3 minutes ago"
  const formatTime = (dateString: string) => {
    return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true });
  };

  // Parse message text to highlight @mentions by wrapping with a styled span
  const parseMessage = useCallback((message: string) => {
    if (!message) return '';
    // Simple mention highlighting by replacing '@username' with a span class 'mention'
    return message.replace(/@(\w+)/g, (match, username) => {
      return `<span class="mention">@${username}</span>`;
    });
  }, []);

  return (
    // Outer container flex column filling viewport height
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      {/* Header fixed at top */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center">
          {/* Back button only visible on small devices */}
          <button
            onClick={() => window.history.back()}
            className="md:hidden mr-3 p-2 rounded-full hover:bg-gray-100"
            aria-label="Back to project"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          {/* Chat title */}
          <h1 className="text-lg font-semibold text-gray-900">Project Chat</h1>
        </div>
      </div>

      {/* Messages container: scrollable area */}
      <div
        className="flex-1 overflow-y-auto p-4 px-5 md:px-6 pb-32 chat-container chat-scrollbar"
        ref={messagesContainerRef}
      >
        <div className="max-w-3xl mx-auto w-full flex flex-col space-y-3">
          {loading ? (
            // Show loading placeholder
            <div className="flex justify-center py-8">
              <div className="animate-pulse text-gray-500">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            // Empty chat UI prompting to start conversation
            <div className="text-center py-12 text-gray-500">
              No messages yet. Be the first to say hi! 👋
            </div>
          ) : (
            // AnimatePresence for message enter/exit animations
            <AnimatePresence initial={false}>
              {messages.map((m, index) => {
                const isCurrentUser = m.username === user?.username;
                // Show avatar & username if this message is the first or username changed
                const showHeader = index === 0 || messages[index - 1]?.username !== m.username;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-3 group`}
                  >
                    {/* Avatar for other users shown only on first message in sequence */}
                    {!isCurrentUser && showHeader && (
                      <div className="flex-shrink-0 mr-2 self-end mb-1">
                        <div className="chat-avatar chat-avatar-receiver">
                          {m.username.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col max-w-[85%]">
                      {/* Username for other users shown only once per sequence */}
                      {!isCurrentUser && showHeader && (
                        <div className="text-xs font-medium text-gray-500 mb-1 ml-1">{m.username}</div>
                      )}

                      {/* Message bubble with different style for sender/receiver */}
                      <div
                        className={`chat-bubble ${
                          isCurrentUser ? 'chat-bubble-sender' : 'chat-bubble-receiver'
                        } ${m.is_sending ? 'opacity-70' : ''}`}
                      >
                        {/* Message text with HTML for mention highlighting (using dangerouslySetInnerHTML!) */}
                        <div
                          className="text-sm break-words leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: parseMessage(m.message) }}
                        />

                        {/* Time & status icons */}
                        <div className="flex items-center justify-end mt-1 message-time">
                          <span>{formatTime(m.created_at)}</span>
                          {isCurrentUser && !m.is_sending && (
                            <span className="ml-1">
                              {/* Check mark icon for sent */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </span>
                          )}
                          {isCurrentUser && m.is_sending && (
                            <span className="ml-1 animate-pulse">
                              {/* Circle loading indicator */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <circle cx="12" cy="12" r="10" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Show time on hover for mobile */}
                      <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 md:hidden">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Avatar for current user shown only once per sequence */}
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
              {/* Invisible element to scroll into view automatically */}
              <div ref={messagesEndRef} />
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Message input form fixed at bottom of screen */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg chat-input-container">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto w-full p-4 px-5 md:px-6">
          <div className="flex flex-row items-center gap-2 w-full max-w-full">
            {/* Input text box */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                const caret = e.target.selectionStart || val.length;

                // Detect mention trigger '@' before caret position
                const lastAt = val.lastIndexOf('@', caret - 1);
                if (lastAt !== -1 && (lastAt === 0 || /\s/.test(val[lastAt - 1]))) {
                  // Extract the query string after '@'
                  const query = val.slice(lastAt + 1, caret);
                  setMentionQuery(query);
                  setMentionStartIdx(lastAt);
                  setShowMentionPopup(true);
                } else {
                  // Hide mention popup if no valid mention detected
                  setShowMentionPopup(false);
                  setMentionQuery('');
                  setMentionStartIdx(null);
                }
              }}
              onKeyDown={(e) => {
                // Send on Enter key; allow Shift+Enter for newline
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

            {/* Mention suggestion popup */}
            <MentionUserPopup
              users={members.filter(
                (m) => m.username !== user?.username && m.username.toLowerCase().includes((mentionQuery || '').toLowerCase())
              )}
              query={mentionQuery}
              show={showMentionPopup}
              anchorRef={inputRef}
              positionAbove={true}
              onSelect={(selectedUser) => {
                if (inputRef.current && mentionStartIdx !== null) {
                  const caret = inputRef.current.selectionStart || input.length;
                  const before = input.slice(0, mentionStartIdx);
                  const after = input.slice(caret);
                  const insert = `@${selectedUser.username} `;
                  setInput(before + insert + after);
                  setShowMentionPopup(false);
                  setMentionQuery('');
                  setMentionStartIdx(null);

                  // Refocus input & move caret after inserted mention
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

            {/* Send button */}
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
          {/* Send instruction */}
          <div className="text-xs text-gray-500 mt-2 text-center opacity-70 font-medium">
            Press Enter to send, Shift+Enter for new line
          </div>
        </form>
        {/* Spacer div to prevent input overlap */}
        <div className="h-4 md:h-0"></div>
      </div>
    </div>
  );
};

export default ProjectChat;
