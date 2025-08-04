import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import FullCalendar from '@fullcalendar/react';          // Main calendar component
import dayGridPlugin from '@fullcalendar/daygrid';      // Month view plugin
import timeGridPlugin from '@fullcalendar/timegrid';    // Week/day time grid plugin
import interactionPlugin from '@fullcalendar/interaction'; // Click/select plugin
import listPlugin from '@fullcalendar/list';            // List view plugin
import styles from './UniversalCalendar.module.css';    // CSS modules styles

// TypeScript interface for event details with optional fields for flexibility
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
  const { user } = useUser();           // Current logged-in user info from context
  const [events, setEvents] = useState<any[]>([]);  // Events for calendar rendering
  const [loading, setLoading] = useState(false);    // Loading state for fetch operations
  const [filter, setFilter] = useState<'all' | 'tasks' | 'events'>('all'); // Filter events
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null); // Selected event details
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);            // Details loading flag
  const [eventComments, setEventComments] = useState<any[]>([]);              // Comments for selected event
  const [newComment, setNewComment] = useState('');                           // New comment input
  const [assignee, setAssignee] = useState('');                               // Assignee input (optional)

  // Helper to format date/time strings for display
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

  // Adds a new comment to the currently selected event/task
  const handleAddComment = async () => {
    // Basic validations: event selected, comment non-empty, user logged in
    if (!selectedEvent || !newComment.trim() || !user) return;

    try {
      // Determine comment insertion data based on event type
      const commentData = {
        [selectedEvent.type === 'task' ? 'task_id' : 'event_id']: selectedEvent.id.replace(/^(task|event)-/, ''),
        username: user.username,
        comment: newComment,
        created_at: new Date().toISOString()
      };

      // Insert new comment into respective table
      const { error } = await supabase
        .from(selectedEvent.type === 'task' ? 'task_comments' : 'event_comments')
        .insert(commentData);

      if (error) throw error;

      // Optimistic UI update for comments
      setEventComments([{
        ...commentData,
        id: Math.random().toString(36).substr(2, 9) // Temporary ID for immediate display
      }, ...eventComments]);

      setNewComment(''); // Clear input

    } catch (error) {
      console.error('Error adding comment:', error);
      // Optionally, set an error state here to notify user
    }
  };

  // Fired when user clicks an event on the calendar
  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event;
    // Fetch detailed info for clicked event/task
    fetchEventDetails(event.id, event.extendedProps.type);
  };

  // Fetch detailed event/task info and associated comments
  const fetchEventDetails = useCallback(async (eventId: string, type: 'task' | 'event') => {
    setIsLoadingDetails(true);

    try {
      if (type === 'task') {
        // Query the task details by ID from tasks table
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

          // Fetch comments for the task, most recent first
          const { data: comments } = await supabase
            .from('task_comments')
            .select('*')
            .eq('task_id', taskData.id)
            .order('created_at', { ascending: false });

          setEventComments(comments || []);
        }
      } else {
        // Query event details by ID from events table
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

          // Fetch comments for the event
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
      // Optionally, set error message here
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // Extract project name safely from the Supabase relation object
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

    // Initial load of events/tasks on mount
    fetchEvents();

    // Subscribe to realtime changes for tasks
    const tasksSubscription = supabase
      .channel('tasks_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'project_tasks', filter: 'is_deleted=false' },
        payload => {
          console.log('Task change received!', payload);
          fetchEvents();
        })
      .subscribe();

    // Subscribe to realtime changes for events
    const eventsSubscription = supabase
      .channel('events_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'project_events', filter: 'is_deleted=false' },
        payload => {
          console.log('Event change received!', payload);
          fetchEvents();
        })
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(tasksSubscription);
      supabase.removeChannel(eventsSubscription);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  // Fetch all tasks and events for calendar, combine and transform into FullCalendar format
  const fetchEvents = async () => {
    setLoading(true);

    // Fetch tasks with project names (join on projects table)
    const { data: tasks } = await supabase
      .from('project_tasks')
      .select('id, title, description, deadline, assignee, status, project_id, is_deleted, projects(name)')
      .eq('is_deleted', false);

    // Fetch events with project names
    const { data: eventsData } = await supabase
      .from('project_events')
      .select('id, topic, description, datetime, end_time, created_by, project_id, is_deleted, projects(name)')
      .eq('is_deleted', false);

    // Transform tasks and events into calendar events
    const calendarEvents: any[] = [];

    if (tasks) {
      for (const t of tasks) {
        if (t.deadline) {
          const projectName = getProjectName(t.projects);
          calendarEvents.push({
            id: 'task-' + t.id,
            title: `Task: ${t.title} [${projectName}]`,
            start: t.deadline,
            end: t.deadline,
            color: '#256ebf',             // Blue color for tasks
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
      for (const e of eventsData) {
        if (e.datetime) {
          const projectName = getProjectName(e.projects);
          calendarEvents.push({
            id: 'event-' + e.id,
            title: `Event: ${e.topic} [${projectName}]`,
            start: e.datetime,
            end: e.end_time || e.datetime,
            color: '#38a169',            // Green color for events
            extendedProps: {
              description: `${e.description || ''}${projectName ? `\nProject: ${projectName}` : ''}`,
              type: 'event',
              project: projectName
            }
          });
        }
      }
    }

    setEvents(calendarEvents);
    setLoading(false);
  };

  // Filter events based on current filter selection
  const filteredEvents = events.filter(ev => {
    if (filter === 'all') return true;
    if (filter === 'tasks') return ev.extendedProps?.type === 'task';
    if (filter === 'events') return ev.extendedProps?.type === 'event';
    return true;
  });

  return (
    <div className={styles.calendarWrapper}>
      {/* Modal to show event/task details and comments */}
      {selectedEvent && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: 20
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: 600,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ margin: 0 }}>
                {selectedEvent.type === 'task' ? 'Task Details' : 'Event Details'}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
                aria-label="Close details modal"
              >
                &times;
              </button>
            </div>
            {/* Modal Content */}
            <div style={{
              padding: 20,
              overflowY: 'auto',
              flex: 1
            }}>
              {/* Event Type Badge and Title */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  display: 'inline-block',
                  backgroundColor: selectedEvent.type === 'task' ? '#256ebf' : '#38a169',
                  color: 'white',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  marginBottom: 8
                }}>
                  {selectedEvent.type}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: '8px 0' }}>
                  {selectedEvent.title}
                </h2>

                {/* Project Name */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: '#f3f4f6',
                  color: '#256ebf',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  marginBottom: 12
                }}>
                  🏢 {selectedEvent.project}
                </div>

                {/* Start and End Dates */}
                <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Start</div>
                    <div style={{ fontWeight: 500 }}>{formatDate(selectedEvent.start)}</div>
                  </div>
                  {selectedEvent.end && (
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>End</div>
                      <div style={{ fontWeight: 500 }}>{formatDate(selectedEvent.end)}</div>
                    </div>
                  )}
                </div>

                {/* Assignee (only for tasks) */}
                {selectedEvent.type === 'task' && selectedEvent.assignee && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Assigned To</div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 13,
                      fontWeight: 500
                    }}>
                      👤 {selectedEvent.assignee}
                    </div>
                  </div>
                )}

              </div>

              {/* Description */}
              {selectedEvent.description && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#4b5563',
                    whiteSpace: 'pre-wrap',
                    backgroundColor: '#f9fafb',
                    padding: 12,
                    borderRadius: 6,
                    lineHeight: 1.5,
                  }}>
                    {selectedEvent.description}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                  Comments
                </div>

                {/* Add Comment Form */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleAddComment()}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb',
                        fontSize: 14
                      }}
                    />
                    <button
                      onClick={handleAddComment}
                      style={{
                        backgroundColor: '#256ebf',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '8px 16px',
                        fontSize: 14,
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div style={{
                  maxHeight: 200,
                  overflowY: 'auto'
                }}>
                  {isLoadingDetails ? (
                    <div style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>
                      Loading comments...
                    </div>
                  ) : eventComments.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9ca1a5', padding: 20 }}>
                      No comments yet. Be the first to comment!
                    </div>
                  ) : (
                    eventComments.map(c => (
                      <div key={c.id} style={{ borderBottom: '1px solid #e5e7eb', padding: '10px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>{c.username}</span>
                          <span style={{ fontSize: 12, color: '#9ca1a5' }}>
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 14, color: '#374151' }}>
                          {c.comment}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Calendar heading and filter controls */}
      <h2 style={{
        color: '#256ebf',
        fontWeight: 800,
        fontSize: '2rem',
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 1,
        userSelect: 'none' // prevent select text on click
      }}>
        📅 Universal Calendar
      </h2>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 18 }}>
        {/* Filter buttons to show tasks/events/all */}
        {['all', 'tasks', 'events'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            style={{
              backgroundColor: filter === f ? '#256ebf' : '#e5e7eb',
              color: filter === f ? 'white' : '#222',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              boxShadow: filter === f ? '0 2px 8px #256ebf66' : undefined,
              userSelect: 'none'
            }}
            aria-pressed={filter === f}
            type="button"
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading indicator or calendar view */}
      {loading ? (
        <div style={{ textAlign: 'center' }}>Loading calendar...</div>
      ) : (
        <div className={styles.calendarContainer}>
          <div className={styles.calendarInner}>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView='dayGridMonth'                     // Default month view
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
              }}
              eventClick={handleEventClick}                   // Handler for clicking events
              height="auto"                                    // Automatically adjust height
              events={filteredEvents}                          // Events filtered by type
              eventContent={renderEventContent}                // Custom rendering function
              dayMaxEvents={3}                                 // Limit of events to show on single day
              eventDisplay='block'                             // Event style
              eventTimeFormat={{                               // Time format in events
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }}
              slotMinTime="06:00:00"                           // Calendar day start time
              slotMaxTime="22:00:00"                           // Calendar day end time
              allDaySlot={false}                               // Hide all-day slot
              nowIndicator                                     // Show current time indicator
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Custom rendering for each event (task or event)
function renderEventContent(eventInfo: any) {
  // Debug log - remove or disable in production
  console.log('Rendering event:', eventInfo);

  // Extract core data
  const type = eventInfo.event.extendedProps?.type || 'event';
  const project = eventInfo.event.extendedProps?.project;
  const description = eventInfo.event.extendedProps?.description;
  const title = eventInfo.event.title || eventInfo.event.extendedProps?.title || 'Untitled';
  const status = eventInfo.event.extendedProps?.status || 'open';

  // Base color by type
  const badgeColor = type === 'task' ? '#256ebf' : '#38a169';

  // Colors for various statuses - adjust or extend as needed
  const statusColors: {[key: string]:string} = {
    'completed': '#10b981',
    'closed': '#6b7280',
    'in progress': '#3b82f6',
    'open': '#f59e0b',
  };

  // Check for special visual states:
  // - Completed or closed tasks/events
  // - Past events or deadlines
  const isCompleted = type === 'task' && (['completed', 'closed'].includes(eventInfo.event.extendedProps?.status));
  const isPastDeadline = new Date(eventInfo.event.start || 0) < new Date();
  const isFaded = isCompleted || isPastDeadline;

  // Base style for event card
  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: 8,
    boxShadow: '0 2px 8px #0001',
    padding: 8,
    marginBottom: 2,
    minWidth: 0,
    transition: 'box-shadow 0.2s ease',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    position: 'relative',
    opacity: isFaded ? 0.7 : 1,
    borderLeft: isFaded ? '3px solid #94a3b8' : '3px solid transparent',
  };

  return (
    <div style={cardStyle} className='calendar-event-card'>
      {/* Display Project Badge */}
      {project && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#f3f4f6',
          color: '#256ebf',
          borderRadius: 4,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          marginBottom: 8,
          userSelect: 'none',
        }}>
          🏢 {project}
        </div>
      )}

      {/* Title and Labels Row */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        {/* Type badge */}
        <div style={{
          backgroundColor: badgeColor,
          color: 'white',
          borderRadius: 5,
          padding: '2px 7px',
          fontSize: 11,
          fontWeight: 700,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {type === 'task' ? 'Task' : 'Event'}
        </div>

        {/* Status badge for tasks */}
        {type === 'task' && status && (
          <div style={{
            backgroundColor: statusColors[status.toLowerCase()] || '#94a3b8',
            color: 'white',
            borderRadius: 5,
            padding: '2px 7px',
            fontSize: 11,
            fontWeight: 600,
            userSelect: 'none',
            textTransform: 'capitalize',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}>
            {status}
          </div>
        )}

        {/* Event/Task title */}
        <span style={{
          fontWeight: 600,
          fontSize: 13,
          color: '#111827',
          whiteSpace: 'normal',
          flex: 1,
        }}>
          {title}
        </span>
      </div>

      {/* Description (with removed project name if embedded) */}
      {description && (
        <pre style={{
          whiteSpace: 'pre-wrap',
          fontSize: 12,
          marginTop: 4,
          color: '#374151',
          userSelect: 'text',
          maxHeight: 60,
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {description.replace(/\nProject: .*/, '')}
        </pre>
      )}

      {/* Status info below title for tasks */}
      {type === 'task' && status && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 8,
          fontSize: 11,
          color: '#6b7280',
          userSelect: 'none'
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: statusColors[status.toLowerCase()] || '#94a3b8',
          }} />
          Status: {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      )}
    </div>
  );
}

export default UniversalCalendar;
