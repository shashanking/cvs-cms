import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import styles from './UniversalCalendar.module.css';

const UniversalCalendar = () => {
  const { user } = useUser();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'tasks' | 'events'>('all');

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
    fetchEvents();
    // eslint-disable-next-line
  }, [user?.username]);

  const fetchEvents = async () => {
    setLoading(true);
    // Fetch all tasks from all projects (with project name)
    const { data: tasks } = await supabase
      .from('project_tasks')
      .select('id, title, description, deadline, assignee, project_id, projects(name)');
    // Fetch all events from all projects (with project name)
    const { data: eventsData } = await supabase
      .from('project_events')
      .select('id, topic, description, datetime, created_by, project_id, projects(name)');
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
            extendedProps: { description: `${t.description || ''}${projectName ? `\nProject: ${projectName}` : ''}`, type: 'task', project: projectName }
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
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
          }}
          height="auto"
          events={filteredEvents}
          eventContent={renderEventContent}
          eventClick={info => {
            alert(info.event.title + (info.event.extendedProps.description ? ('\n' + info.event.extendedProps.description) : ''));
          }}
        />
      )}
    </div>
  );
};

function renderEventContent(eventInfo: any) {
  const type = eventInfo.event.extendedProps.type;
  const project = eventInfo.event.extendedProps.project;
  const description = eventInfo.event.extendedProps.description;
  const badgeColor = type === 'task' ? '#2563eb' : '#38a169';
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px #0001',
        padding: '6px 10px',
        marginBottom: 2,
        minWidth: 0,
        transition: 'box-shadow 0.2s',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
      }}
      className="calendar-event-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          }}
        >{type === 'task' ? 'Task' : 'Event'}</span>
        <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'pre-wrap', flex: 1 }}>{eventInfo.event.title.replace(/^\w+: /, '').replace(/ \[.*\]$/, '')}</span>
        {project && (
          <span
            style={{
              background: '#f3f4f6',
              color: '#2563eb',
              borderRadius: 4,
              fontSize: 11,
              padding: '2px 6px',
              marginLeft: 4,
              fontWeight: 500,
              letterSpacing: 0.2,
              border: '1px solid #e5e7eb',
            }}
          >{project}</span>
        )}
      </div>
      {description && (
        <div style={{ fontWeight: 400, fontSize: 12, color: '#666', marginTop: 2, whiteSpace: 'pre-wrap' }}>{description.replace(/\nProject: .*/, '')}</div>
      )}
    </div>
  );
}

export default UniversalCalendar;
