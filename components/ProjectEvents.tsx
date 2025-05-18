import React, { useState, useEffect, CSSProperties } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

interface ProjectEventsProps {
}

interface CheckIn {
  username: string;
  created_at?: string;
}

interface EventItem {
  id: number;
  topic: string;
  description: string;
  datetime: string | null;
  repeat: string | null;
  created_by: string;
  created_at: string;
  is_deleted: boolean;
  check_ins?: CheckIn[];
}

interface CommentItem {
  id: number;
  event_id: number;
  username: string;
  comment: string;
  check_in: boolean;
  created_at: string;
}

export function ProjectEventsComponent() {
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;
  const [events, setEvents] = useState<EventItem[]>([]);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [datetime, setDatetime] = useState('');
  const [repeat, setRepeat] = useState('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (!projectId) return;
    fetchEvents();
  }, [projectId]);

  const fetchEvents = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('project_events')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('datetime', { ascending: true });
    if (error) setError(error.message);
    setEvents(data || []);
    setLoading(false);
  };

  const logEventAction = async (action: string, eventId: number, details: any) => {
    try {
      const { error } = await supabase.from('event_logs').insert([{
        event_id: eventId,
        project_id: projectId,
        action,
        performed_by: user.username,
        details: { ...details, timestamp: new Date().toISOString() },
        created_at: new Date().toISOString()
      }]);
      if (error) throw error;
    } catch (error) {
      console.error('Error logging event action:', error);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Project not loaded yet.');
      return;
    }
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          topic,
          description,
          datetime: datetime || null,
          repeat,
          created_by: user.username,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create event');
      }

      const eventData = await res.json();
      const eventId = eventData.event?.id;
      
      if (eventId) {
        // Notify members
        try {
          const topicVal = topic;
          const staticMembers = [
            'vikash',
            'rini',
            'pradip',
            'shashank',
            'sahil',
            'sayan'
          ];
          
          const notifRes = await fetch('/api/eventNotification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: projectId,
              event_id: eventId,
              event_topic: topicVal,
              created_by: user.username,
              all_usernames: staticMembers
            })
          });
          
          if (!notifRes.ok) {
            console.error('Failed to send notifications');
          }
        } catch (e) {
          console.error('Error sending notifications:', e);
        }
      }
      
      // Reset form and refresh events
      setTopic('');
      setDescription('');
      setDatetime('');
      setRepeat('single');
      await fetchEvents();
      
    } catch (error) {
      setError(error.message);
      console.error('Error creating event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = async (event: EventItem) => {
    setSelectedEvent(event);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_comments')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: true });
      if (!error) setComments(data || []);
    } catch (error) {
      console.error('Error fetching event comments:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteEvent = async (eventId: number) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      // Soft delete: set is_deleted to true, updated_by, and updated_at
      // The database trigger will automatically log the deletion
      const { error } = await supabase
        .from('project_events')
        .update({ 
          is_deleted: true, 
          updated_by: user.username, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', eventId);

      if (error) throw error;

      // Refresh events list
      await fetchEvents();
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateEvent = async (updatedEvent: EventItem) => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('project_events')
        .update(updatedEvent)
        .eq('id', updatedEvent.id);
        
      if (error) throw error;
      
      // Log the event update
      await logEventAction('event_updated', updatedEvent.id, {
        topic: updatedEvent.topic,
        description: updatedEvent.description,
        datetime: updatedEvent.datetime,
        repeat: updatedEvent.repeat,
        updated_at: new Date().toISOString()
      });
      
      // Refresh events list
      await fetchEvents();
      
    } catch (error) {
      console.error('Error updating event:', error);
      setError('Failed to update event');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (checkIn = false) => {
    console.log('[DEBUG] handleAddComment called with checkIn:', checkIn);
    if (!selectedEvent) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/eventComment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          username: user.username,
          comment: checkIn ? '' : commentText,
          check_in: checkIn,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add comment/check-in');
      }

      const newComment = await res.json();
      
      // If this was a check-in, refresh the events and comments
      if (checkIn) {
        // Refresh the comments list to include the new check-in
        const { data: updatedComments, error: commentsError } = await supabase
          .from('event_comments')
          .select('*')
          .eq('event_id', selectedEvent.id)
          .order('created_at', { ascending: true });
          
        if (!commentsError) {
          setComments(updatedComments || []);
        }
        
        // Also refresh the events list to update the check-in count
        await fetchEvents();
      } else {
        // For regular comments, just update the comments list
        setComments(prev => [...prev, newComment]);
        setCommentText('');

      }
      
      // Mark event notification as read after check-in
      if (checkIn && user && projectId) {
        if (typeof window !== 'undefined' && typeof (window as any).markEventNotificationRead === 'function') {
          (window as any).markEventNotificationRead(selectedEvent.id, user.username, projectId);
        } else if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('eventNotificationRead', {
            detail: { eventId: selectedEvent.id, username: user.username, projectId }
          }));
        }
        window.dispatchEvent(new Event('refreshNotifications'));
      }
    } catch (error) {
      setError(error.message);
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!projectId) return <div>Loading project events...</div>;
  // State for responsive layout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Styles
  const containerStyle: CSSProperties = {
    padding: isMobile ? '4vw' : '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
    boxSizing: 'border-box'
  };

  const formStyle: CSSProperties = {
    marginBottom: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  };

  const mainContentStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: '1.5rem',
    width: '100%'
  };

  const detailSectionStyle: CSSProperties = {
    flex: 2,
    width: '100%',
    marginTop: isMobile ? '1.5rem' : 0,
    paddingLeft: isMobile ? 0 : '1.5rem',
    borderLeft: isMobile ? 'none' : '1px solid #e5e7eb',
    boxSizing: 'border-box'
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#2563eb' }}>Events</h3>
      <form onSubmit={handleCreateEvent} style={formStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input 
            value={topic} 
            onChange={e => setTopic(e.target.value)} 
            placeholder="Event topic" 
            required 
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }} 
          />
          <input 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder="Description" 
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }} 
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input 
              type="datetime-local" 
              value={datetime} 
              onChange={e => setDatetime(e.target.value)} 
              style={{ flex: 1, minWidth: '200px', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }} 
            />
            <select 
              value={repeat} 
              onChange={e => setRepeat(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
            >
              <option value="single">Single</option>
              <option value="repeat">Repeat</option>
            </select>
            <button 
              type="submit" 
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </div>
      </form>
      {error && <div style={{ color: '#ef4444', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#fef2f2', borderRadius: '0.375rem' }}>{error}</div>}
      <div style={mainContentStyle}>
        <div style={{ flex: 1 }}>
          <h4>Upcoming Events</h4>
          {loading ? <div>Loading...</div> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {events.length === 0 ? (
                <li style={{ color: '#888', fontStyle: 'italic', marginTop: 12 }}>No events yet. Create one above!</li>
              ) : events.map(ev => {
                const evCheckins = comments.filter(c => c.event_id === ev.id && c.check_in);
                const shown = evCheckins.slice(0, 5);
                const more = evCheckins.length > 5 ? evCheckins.length - 5 : 0;
                return (
                  <li
                    key={ev.id}
                    style={{
                      marginBottom: 12,
                      background: selectedEvent?.id === ev.id ? '#ebf8ff' : '#f7fafc',
                      borderRadius: 8,
                      padding: 14,
                      cursor: 'pointer',
                      border: selectedEvent?.id === ev.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      boxShadow: selectedEvent?.id === ev.id ? '0 2px 8px #2563eb22' : 'none',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}
                    onClick={() => handleSelectEvent(ev)}
                  >
                    {/* Avatar (initials) */}
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: '#2563eb22',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 18,
                      marginRight: 8
                    }}>
                      {ev.created_by.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>
                          {ev.topic} 
                          <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>
                            {ev.datetime ? new Date(ev.datetime).toLocaleString() : ''}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(ev.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'background 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <span>🗑️</span>
                          <span>Delete</span>
                        </button>
                      </div>
                      <div style={{ fontSize: 13, margin: '2px 0 4px 0', color: '#333' }}>{ev.description}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#666' }}>By {ev.created_by}</span>
                        {/* Badge for repeat/single */}
                        <span style={{
                          background: ev.repeat === 'repeat' ? '#fbbf24' : '#22d3ee',
                          color: ev.repeat === 'repeat' ? '#92400e' : '#0e7490',
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 600
                        }}>{ev.repeat === 'repeat' ? 'Repeats' : 'Single'}</span>
                        {/* Check-in summary */}
                        {evCheckins.length > 0 && (
                          <span style={{ background: '#e6fffa', color: '#319795', fontWeight: 500, fontSize: 12, borderRadius: 8, padding: '2px 8px' }}>
                            Checked in: {shown.map((e, idx) => (
                                <span key={e.id || idx}>{e.username} ({new Date(e.created_at).toLocaleString()}){idx < shown.length - 1 ? ', ' : ''}</span>
                              ))}{more > 0 ? ` +${more} more` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div style={detailSectionStyle}>
          {selectedEvent ? (
            <div>
              <h4>Event: {selectedEvent.topic}</h4>
              <div style={{ marginBottom: '1rem' }}>{selectedEvent.description}</div>
              <div style={{ 
                marginBottom: '1rem', 
                color: '#4b5563', 
                fontSize: '0.875rem',
                backgroundColor: '#f9fafb',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                display: 'inline-block'
              }}>
                📅 {selectedEvent.datetime ? new Date(selectedEvent.datetime).toLocaleString() : 'No date set'}
              </div>
              <div style={{ 
                marginBottom: '1.5rem', 
                display: 'flex', 
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <button 
                  onClick={() => {
                    console.log('[DEBUG] Check In button clicked');
                    handleAddComment(true);
                  }}
                  disabled={loading}
                  style={{ 
                    marginRight: 10, 
                    background: '#319795',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>✓</span> Check In
                </button>
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '0.5rem',
                  width: '100%'
                }}>
                  <input 
                    value={commentText} 
                    onChange={e => setCommentText(e.target.value)} 
                    placeholder="Add a comment..." 
                    style={{ 
                      flex: 1, 
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.375rem',
                      width: '100%',
                      boxSizing: 'border-box'
                    }} 
                  />
                  <button 
                    onClick={() => handleAddComment(false)} 
                    disabled={loading || !commentText}
                    style={{
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      opacity: (loading || !commentText) ? 0.6 : 1,
                      width: '100%',
                      ...(window.innerWidth > 640 ? { width: 'auto', minWidth: '80px' } : {})
                    }}
                  >
                    {loading ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
              <div style={{ 
                overflowX: 'auto', 
                marginTop: '1.5rem',
                WebkitOverflowScrolling: 'touch',
                msOverflowStyle: 'none' as any,
                scrollbarWidth: 'none' as any
              }}>
                <table style={{ 
                  width: '100%', 
                  minWidth: '640px',
                  borderCollapse: 'separate', 
                  borderSpacing: 0, 
                  fontSize: '0.875rem', 
                  background: '#fff', 
                  borderRadius: '0.75rem', 
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                  overflow: 'hidden' 
                }}>
                  <thead style={{ background: 'linear-gradient(to right, #f9fafb, #f3f4f6)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1.25rem', borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontWeight: 600, color: '#4b5563', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Action</th>
                      <th style={{ padding: '0.75rem 1.25rem', borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontWeight: 600, color: '#4b5563', letterSpacing: '0.05em', fontSize: '0.75rem' }}>User</th>
                      <th style={{ padding: '0.75rem 1.25rem', borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontWeight: 600, color: '#4b5563', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Time</th>
                      <th style={{ padding: '0.75rem 1.25rem', borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontWeight: 600, color: '#4b5563', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comments.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                          No comments or check-ins yet.
                        </td>
                      </tr>
                    ) : (
                      comments.map((c, i) => (
                        <tr key={c.id} style={{ 
                          borderBottom: '1px solid #e5e7eb', 
                          transition: 'background 0.2s ease',
                          ...(window.innerWidth > 768 ? { ':hover': { backgroundColor: '#f9fafb' } } : {})
                        }}>
                          <td style={{ padding: '0.75rem 1.25rem', borderRight: '1px solid #f3f4f6' }}>
                            {c.check_in ? 
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 500, color: '#7e22ce', background: '#f3e8ff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                ✅ Checked In
                              </span> : 
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 500, color: '#4f46e5', background: '#e0e7ff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                💬 Comment
                              </span>
                            }
                          </td>
                          <td style={{ padding: '0.75rem 1.25rem', borderRight: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                              <div style={{ 
                                width: '2rem', 
                                height: '2rem', 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', 
                                color: '#2563eb', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontWeight: 600, 
                                fontSize: '0.75rem', 
                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' 
                              }}>
                                {typeof c.username === 'string' ? c.username.slice(0, 2).toUpperCase() : '--'}
                              </div>
                              <span style={{ fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{c.username}</span>
                            </div>
                          </td>
                          <td style={{ 
                            padding: '0.75rem 1.25rem', 
                            color: '#6b7280', 
                            borderRight: '1px solid #f3f4f6',
                            whiteSpace: 'nowrap',
                            fontSize: '0.75rem'
                          }}>
                            {c.created_at ? new Date(c.created_at).toLocaleString() : '-'}
                          </td>
                          <td style={{ 
                            padding: '0.75rem 1.25rem', 
                            color: '#374151', 
                            lineHeight: 1.5,
                            fontSize: '0.875rem'
                          }}>
                            {!c.check_in && c.comment ? c.comment : (c.check_in ? 'Checked in to the event' : '-')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ 
              color: '#6b7280', 
              textAlign: 'center', 
              padding: '2rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              border: '1px dashed #e5e7eb'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📅</div>
              <p style={{ margin: 0 }}>Select an event to see details, comment, or check in.</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
                {events.length === 0 ? 'No events available. Create one above!' : 'Click on an event from the list'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
