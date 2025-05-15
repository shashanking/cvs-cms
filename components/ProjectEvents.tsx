import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

interface ProjectEventsProps {
}

interface EventItem {
  id: number;
  topic: string;
  description: string;
  datetime: string | null;
  repeat: string | null;
  created_by: string;
  created_at: string;
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
      .order('datetime', { ascending: true });
    if (error) setError(error.message);
    setEvents(data || []);
    setLoading(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Project not loaded yet.');
      return;
    }
    setLoading(true);
    setError(null);
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
      setError(data.error || 'Failed to create event');
    } else {
      // Use static list of project members for notifications
      try {
        const eventData = await res.json();
        const eventId = String(eventData.event?.id ?? '');
        const topicVal = topic;
        const staticMembers = [
          'vikash',
          'rini',
          'pradip',
          'shashank',
          'sahil',
          'sayan'
        ];
        // Debug log for event notification payload
        // eslint-disable-next-line no-console
        console.log('Sending event notification:', {
          project_id: projectId,
          event_id: eventId,
          event_topic: topicVal,
          created_by: user.username,
          all_usernames: staticMembers
        });
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
        // eslint-disable-next-line no-console
        console.log('eventNotification API response:', await notifRes.json());
      } catch (e) { /* ignore notification errors for now */ }
      setTopic('');
      setDescription('');
      setDatetime('');
      setRepeat('single');
      fetchEvents();
    }
    setLoading(false);
  };

  const handleSelectEvent = async (event: EventItem) => {
    setSelectedEvent(event);
    setLoading(true);
    const { data, error } = await supabase
      .from('event_comments')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true });
    if (!error) setComments(data || []);
    setLoading(false);
  };

  const handleAddComment = async (checkIn = false) => {
    if (!selectedEvent) return;
    setLoading(true);
    setError(null);
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
      setError(data.error || 'Failed to add comment/check-in');
    } else {
      setCommentText('');
      handleSelectEvent(selectedEvent);
    }
    setLoading(false);
  };

  if (!projectId) return <div>Loading project events...</div>;
  return (
    <div style={{ margin: '4vw 0' }}>
      <h3 style={{ fontSize: '5vw', marginBottom: '3vw', color: '#2563eb' }}>Events</h3>
      <form onSubmit={handleCreateEvent} style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Event topic" required style={{ minWidth: 180 }} />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" style={{ minWidth: 220 }} />
        <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} />
        <select value={repeat} onChange={e => setRepeat(e.target.value)}>
          <option value="single">Single</option>
          <option value="repeat">Repeat</option>
        </select>
        <button type="submit" disabled={loading}>Create Event</button>
      </form>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <h4>Upcoming Events</h4>
          {loading ? <div>Loading...</div> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {events.length === 0 ? (
  <li style={{ color: '#888', fontStyle: 'italic', marginTop: 12 }}>No events yet. Create one above!</li>
) : events.map(ev => (
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
      <div style={{ fontWeight: 700, fontSize: 16 }}>{ev.topic} <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>{ev.datetime ? new Date(ev.datetime).toLocaleString() : ''}</span></div>
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
      </div>
    </div>
  </li>
))}
            </ul>
          )}
        </div>
        <div style={{ flex: 2 }}>
          {selectedEvent ? (
            <div>
              <h4>Event: {selectedEvent.topic}</h4>
              <div style={{ marginBottom: 8 }}>{selectedEvent.description}</div>
              <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>{selectedEvent.datetime ? new Date(selectedEvent.datetime).toLocaleString() : ''}</div>
              <div style={{ marginBottom: 16 }}>
                <button onClick={() => handleAddComment(true)} disabled={loading} style={{ marginRight: 10 }}>Check In</button>
                <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..." style={{ minWidth: 180 }} />
                <button onClick={() => handleAddComment(false)} disabled={loading || !commentText}>Comment</button>
              </div>
              <h5>Comments & Check-ins</h5>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {comments.length === 0 ? (
  <li style={{ color: '#888', fontStyle: 'italic', marginTop: 8 }}>No comments or check-ins yet.</li>
) : comments.map(c => (
  <li
    key={c.id}
    style={{
      marginBottom: 10,
      background: c.check_in ? '#e6fffa' : '#edf2f7',
      borderRadius: 8,
      padding: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }}
  >
    {/* Avatar (initials) */}
    <div style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: c.check_in ? '#31979522' : '#2563eb22',
      color: c.check_in ? '#319795' : '#2563eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 15
    }}>
      {c.username.slice(0, 2).toUpperCase()}
    </div>
    <div>
      <span style={{ fontWeight: 600 }}>{c.username}</span>{' '}
      {c.check_in ? <span style={{ color: '#319795', fontWeight: 600, marginLeft: 4 }}>Checked in</span> : <span style={{ color: '#222', marginLeft: 4 }}>{c.comment}</span>}
      <span style={{ marginLeft: 10, color: '#888', fontSize: 12 }}>{new Date(c.created_at).toLocaleString()}</span>
    </div>
  </li>
))}
              </ul>
            </div>
          ) : <div style={{ color: '#888' }}>Select an event to see details, comment, or check in.</div>}
        </div>
      </div>
    </div>
  );
}
