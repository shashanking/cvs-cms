import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import styles from './UniversalCalendar.module.css';

interface EventDetails {
  id: string;
  title: string;
  type: 'task' | 'event';
  description: string;
  project: string;
  start: string;
  end?: string;
  assignee?: string;
  status?: string;
  comments?: Array<{
    id: string;
    username: string;
    comment: string;
    created_at: string;
  }>;
}

const UniversalCalendar = () => {
  const { user } = useUser();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'tasks' | 'events'>('all');
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [eventComments, setEventComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [assignee, setAssignee] = useState('');

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAddComment = async () => {
    if (!selectedEvent || !newComment.trim() || !user) return;
    
    try {
      const commentData = {
        [selectedEvent.type === 'task' ? 'task_id' : 'event_id']: selectedEvent.id.replace(/^(task|event)-/, ''),
        username: user.username,
        comment: newComment,
        created_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from(selectedEvent.type === 'task' ? 'task_comments' : 'event_comments')
        .insert(commentData);
      
      if (error) throw error;
      
      // Refresh comments
      setEventComments([{
        ...commentData,
        id: Math.random().toString(36).substr(2, 9) // temp id
      }, ...eventComments]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event;
    fetchEventDetails(event.id, event.extendedProps.type);
  };

  const fetchEventDetails = useCallback(async (eventId: string, type: 'task' | 'event') => {
    setIsLoadingDetails(true);
    try {
      // Fetch additional details based on event type
      if (type === 'task') {
        const { data: taskData } = await supabase
          .from('project_tasks')
          .select('*')
          .eq('id', eventId.replace('task-', ''))
          .single();

        if (taskData) {
          setSelectedEvent({
            id: `task-${taskData.id}`,
            title: taskData.title,
            type: 'task',
            description: taskData.description || '',
            project: taskData.project_id,
            start: taskData.deadline,
            assignee: taskData.assignee,
            status: taskData.status
          });
          
          // Fetch comments for task
          const { data: comments } = await supabase
            .from('task_comments')
            .select('*')
            .eq('task_id', taskData.id)
            .order('created_at', { ascending: false });
          
          setEventComments(comments || []);
        }
      } else {
        const { data: eventData } = await supabase
          .from('project_events')
          .select('*')
          .eq('id', eventId.replace('event-', ''))
          .single();

        if (eventData) {
          setSelectedEvent({
            id: `event-${eventData.id}`,
            title: eventData.topic,
            type: 'event',
            description: eventData.description || '',
            project: eventData.project_id,
            start: eventData.datetime,
            end: eventData.end_time
          });
          
          // Fetch comments for event
          const { data: comments } = await supabase
            .from('event_comments')
            .select('*')
            .eq('event_id', eventData.id)
            .order('created_at', { ascending: false });
          
          setEventComments(comments || []);
        }
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // Utility to extract project name from Supabase relation
  const getProjectName = (projects: any): string => {
    if (!projects) return 'Unknown Project';
    if (Array.isArray(projects)) {
      return projects.length > 0 && typeof projects[0]?.name === 'string' ? projects[0].name : 'Unknown Project';
    }
    if (typeof projects === 'object' && typeof projects.name === 'string') {
      return projects.name;
    }
    return 'Unknown Project';
  };

  useEffect(() => {
    if (!user?.username) return;
    
    // Initial fetch
    fetchEvents();
    
    // Set up real-time subscriptions
    const tasksSubscription = supabase
      .channel('tasks_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'project_tasks',
          filter: 'is_deleted=eq.false'
        }, 
        (payload) => {
          console.log('Task change received!', payload);
          fetchEvents();
        }
      )
      .subscribe();

    const eventsSubscription = supabase
      .channel('events_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'project_events',
          filter: 'is_deleted=eq.false'
        }, 
        (payload) => {
          console.log('Event change received!', payload);
          fetchEvents();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(tasksSubscription);
      supabase.removeChannel(eventsSubscription);
    };
    // eslint-disable-next-line
  }, [user?.username]);

  const fetchEvents = async () => {
    setLoading(true);
    // Fetch all non-deleted tasks from all projects (with project name and status)
    const { data: tasks } = await supabase
      .from('project_tasks')
      .select('id, title, description, deadline, assignee, status, project_id, is_deleted, projects(name)')
      .eq('is_deleted', false);
    // Fetch all non-deleted events from all projects (with project name)
    const { data: eventsData } = await supabase
      .from('project_events')
      .select('id, topic, description, datetime, created_by, project_id, is_deleted, projects(name)')
      .eq('is_deleted', false);
    // Transform to FullCalendar event format
    const calendarEvents = [];
    if (tasks) {
      for (const t of tasks) {
        if (t.deadline) {
          let projectName = 'Unknown Project';
const getProjectName = (projects: any): string => {
  if (!projects) return 'Unknown Project';
  if (Array.isArray(projects)) {
    return projects.length > 0 && typeof projects[0]?.name === 'string' ? projects[0].name : 'Unknown Project';
  }
  if (typeof projects === 'object' && typeof projects.name === 'string') {
    return projects.name;
  }
  return 'Unknown Project';
};
projectName = getProjectName(t.projects);
          calendarEvents.push({
            id: 'task-' + t.id,
            title: `Task: ${t.title} [${projectName}]`,
            start: t.deadline,
            end: t.deadline,
            color: '#2563eb',
            extendedProps: { 
              description: `${t.description || ''}${projectName ? `\nProject: ${projectName}` : ''}`, 
              type: 'task', 
              project: projectName,
              status: t.status || 'open' 
            }
          });
        }
      }
    }
    if (eventsData) {
      console.log('Fetched eventsData:', eventsData);
      for (const e of eventsData) {
        if (e.datetime) {
          let projectName = 'Unknown Project';
          projectName = getProjectName(e.projects);
          calendarEvents.push({
            id: 'event-' + e.id,
            title: `Event: ${e.topic} [${projectName}]`,
            start: e.datetime,
            end: e.datetime,
            color: '#38a169',
            extendedProps: { description: `${e.description || ''}${projectName ? `\nProject: ${projectName}` : ''}`, type: 'event', project: projectName }
          });
        }
      }
    }
    setEvents(calendarEvents);
    setLoading(false);
  };

  // Filter events based on switch
  const filteredEvents = events.filter(ev => {
    if (filter === 'all') return true;
    if (filter === 'tasks') return ev.extendedProps?.type === 'task';
    if (filter === 'events') return ev.extendedProps?.type === 'event';
    return true;
  });

  return (
    <div className={styles.calendarWrapper}>
      {/* Event Details Modal */}
      {selectedEvent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                {selectedEvent.type === 'task' ? 'Task Details' : 'Event Details'}
              </h3>
              <button 
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {/* Title and Type */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'inline-block',
                  background: selectedEvent.type === 'task' ? '#2563eb' : '#38a169',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {selectedEvent.type}
                </div>
                <h2 style={{ margin: '8px 0', fontSize: '20px', fontWeight: 600 }}>
                  {selectedEvent.title}
                </h2>
                
                {/* Project */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#f3f4f6',
                  color: '#2563eb',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '12px'
                }}>
                  🏢 {selectedEvent.project}
                </div>

                {/* Dates */}
                <div style={{ marginTop: '16px', display: 'flex', gap: '24px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Start</div>
                    <div style={{ fontWeight: 500 }}>{formatDate(selectedEvent.start)}</div>
                  </div>
                  {selectedEvent.end && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>End</div>
                      <div style={{ fontWeight: 500 }}>{formatDate(selectedEvent.end)}</div>
                    </div>
                  )}
                </div>

                {/* Assignee (for tasks) */}
                {selectedEvent.type === 'task' && selectedEvent.assignee && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Assigned To</div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: '#e0f2fe',
                      color: '#0369a1',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: 500
                    }}>
                      👤 {selectedEvent.assignee}
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedEvent.description && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Description</div>
                  <div style={{
                    background: '#f9fafb',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: '#4b5563',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {selectedEvent.description}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>
                  Comments
                </div>
                
                {/* Add Comment */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                    />
                    <button
                      onClick={handleAddComment}
                      style={{
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0 16px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {isLoadingDetails ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Loading comments...</div>
                  ) : eventComments.length > 0 ? (
                    eventComments.map((comment) => (
                      <div key={comment.id} style={{
                        padding: '12px 0',
                        borderBottom: '1px solid #f3f4f6'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{comment.username}</span>
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', color: '#4b5563' }}>
                          {comment.comment}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                      No comments yet. Be the first to comment!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <h2 style={{ color: '#2563eb', fontWeight: 800, fontSize: '2rem', marginBottom: 18, textAlign: 'center', letterSpacing: 1 }}>📅 Universal Calendar</h2>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 18 }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            background: filter === 'all' ? '#2563eb' : '#e5e7eb',
            color: filter === 'all' ? '#fff' : '#222',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            boxShadow: filter === 'all' ? '0 2px 8px #2563eb33' : undefined
          }}
        >All</button>
        <button
          onClick={() => setFilter('tasks')}
          style={{
            background: filter === 'tasks' ? '#2563eb' : '#e5e7eb',
            color: filter === 'tasks' ? '#fff' : '#222',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            boxShadow: filter === 'tasks' ? '0 2px 8px #2563eb33' : undefined
          }}
        >Tasks</button>
        <button
          onClick={() => setFilter('events')}
          style={{
            background: filter === 'events' ? '#2563eb' : '#e5e7eb',
            color: filter === 'events' ? '#fff' : '#222',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            boxShadow: filter === 'events' ? '0 2px 8px #2563eb33' : undefined
          }}
        >Events</button>
      </div>
      {loading ? <div>Loading calendar...</div> : (
        <div className={styles.calendarContainer}>
          <div className={styles.calendarInner}>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
              }}
              eventClick={handleEventClick}
              height="auto"
              events={filteredEvents}
              eventContent={renderEventContent}
              dayMaxEvents={3}
              eventDisplay='block'
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={false}
              nowIndicator
            />
          </div>
        </div>
      )}
    </div>
  );
};

function renderEventContent(eventInfo: any) {
  console.log('Rendering event:', eventInfo);
  const type = eventInfo.event.extendedProps?.type || 'event';
  const project = eventInfo.event.extendedProps?.project;
  const description = eventInfo.event.extendedProps?.description;
  const title = eventInfo.event.title || eventInfo.event.extendedProps?.title || 'Untitled';
  const status = eventInfo.event.extendedProps?.status || 'open';
  const badgeColor = type === 'task' ? '#2563eb' : '#38a169';
  
  const statusColors: {[key: string]: string} = {
    'completed': '#10b981',
    'closed': '#6b7280',
    'in progress': '#3b82f6',
    'open': '#f59e0b'
  };
  
  console.log('Title:', title, 'Type:', type);
  
  // Check if task is completed or event is in the past
  const isCompleted = type === 'task' && 
    (eventInfo.event.extendedProps.status === 'completed' || 
     eventInfo.event.extendedProps.status === 'closed');
  const isPastDeadline = new Date(eventInfo.event.start || 0) < new Date();
  const isFaded = isCompleted || (type === 'task' && isPastDeadline) || (type === 'event' && isPastDeadline);
  
  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 2px 8px #0001',
    padding: '8px 10px',
    marginBottom: 2,
    minWidth: 0,
    transition: 'box-shadow 0.2s',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    position: 'relative',
    opacity: isFaded ? 0.7 : 1,
    borderLeft: isFaded ? '3px solid #94a3b8' : '3px solid transparent'
  };
  return (
    <div
      style={cardStyle}
      className="calendar-event-card"
    >
      {project && (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          marginBottom: 2
        }}>
          <span
            style={{
              background: '#f3f4f6',
              color: '#2563eb',
              borderRadius: 4,
              fontSize: 11,
              padding: '2px 8px',
              fontWeight: 600,
              letterSpacing: 0.3,
              border: '1px solid #e5e7eb',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>🏢</span>
            {project}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              background: badgeColor,
              color: '#fff',
              borderRadius: 5,
              fontSize: 11,
              padding: '2px 7px',
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              flexShrink: 0
            }}
          >{type === 'task' ? 'Task' : 'Event'}</span>
          {type === 'task' && status && (
            <span
              style={{
                background: statusColors[status.toLowerCase()] || '#94a3b8',
                color: '#fff',
                borderRadius: 5,
                fontSize: 11,
                padding: '2px 7px',
                fontWeight: 600,
                textTransform: 'capitalize',
                flexShrink: 0
              }}
            >
              {status}
            </span>
          )}
        </div>
        <span style={{ 
          fontWeight: 600, 
          fontSize: 13, 
          whiteSpace: 'pre-wrap',
          flex: 1,
          lineHeight: 1.3,
          color: '#1f2937' // Dark gray for better visibility
        }}>
          {title}
        </span>
      </div>
      {description && (
        <div style={{ 
          fontWeight: 400, 
          fontSize: 12, 
          color: '#666', 
          marginTop: 0, 
          whiteSpace: 'pre-wrap',
          lineHeight: 1.4
        }}>
          {description.replace(/\nProject: .*/, '')}
        </div>
      )}
      {type === 'task' && status && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: '#6b7280',
          marginTop: 2
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColors[status.toLowerCase()] || '#94a3b8'
          }} />
          <span>Status: {status}</span>
        </div>
      )}
    </div>
  );
}

export default UniversalCalendar;
