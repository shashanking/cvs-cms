import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

// Interface describing the shape of a task object
interface TaskItem {
  id: string;
  title: string;
  description: string;
  assignee: string;
  status: string;
  created_by: string;
  created_at: string;
  deadline: string | null;
  is_deleted?: boolean; // Optional flag to exclude deleted tasks
}

// Default member list fallback (if not passed as prop)
const DEFAULT_MEMBERS = ['vikash', 'rini', 'pradip', 'shashank', 'sahil', 'sayan'];

// Props interface (optional members list can be passed)
interface ProjectTasksComponentProps {
  members?: string[];
}

export default function ProjectTasksComponent({ members }: ProjectTasksComponentProps) {
  const { user } = useUser();        // Current logged-in user
  const { project } = useProject();  // Current project info

  const projectId = project?.id;

  // State: list of tasks
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  // Form inputs state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState('open');
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List of members to assign tasks to, either from prop or default
  const memberList = members || DEFAULT_MEMBERS;

  // Fetch tasks when the project changes (or on mount)
  useEffect(() => {
    if (!projectId) return;   // Wait till project is loaded
    fetchTasks();
  }, [projectId]);

  // Fetch tasks from backend ignoring deleted tasks, ordered by newest first
  async function fetchTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setTasks([]);
    } else {
      setTasks(data || []);
      setError(null);
    }
    setLoading(false);
  }

  // Handle new task creation form submit with optimistic UI update
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();

    // Basic validation before submission
    if (!title.trim()) {
      setError('Please enter a task title.');
      return;
    }
    if (!assignee) {
      setError('Please select an assignee.');
      return;
    }
    if (!deadline) {
      setError('Please select a deadline.');
      return;
    }
    if (!projectId) {
      setError('Project information not loaded yet.');
      return;
    }

    setLoading(true);
    setError(null);

    // Create optimistic task with temporary ID and current data
    const optimisticTask: TaskItem = {
      id: 'temp-' + Math.random().toString(36).substring(2),
      title: title.trim(),
      description,
      assignee,
      status,
      created_by: user.username,
      created_at: new Date().toISOString(),
      deadline,
    };

    // Add the optimistic task immediately so user sees instant feedback
    setTasks(prev => [optimisticTask, ...prev]);

    try {
      // Insert real task into database
      const { data, error } = await supabase.from('project_tasks')
        .insert([
          {
            project_id: projectId,
            title: optimisticTask.title,
            description: optimisticTask.description,
            assignee: optimisticTask.assignee,
            status: optimisticTask.status,
            created_by: optimisticTask.created_by,
            deadline: optimisticTask.deadline,
          }
        ])
        .select()
        .single();  // Get the inserted task row

      if (error) throw error;

      // Replace the optimistic task with the real one (with real DB id)
      setTasks(prev => [data, ...prev.filter(t => t.id !== optimisticTask.id)]);

      // Clear the form inputs after successful creation
      setTitle('');
      setDescription('');
      setAssignee('');
      setDeadline('');
      setStatus('open');

    } catch (err: any) {
      // Show error and rollback optimistic update on failure
      setError(err.message || 'Failed to create task.');
      setTasks(prev => prev.filter(t => t.id !== optimisticTask.id));
    }

    setLoading(false);
  }

  if (!projectId) return <div>Loading tasks...</div>;

  return (
    <div style={{ margin: '4vw 0' }}>
      <h3>Project Tasks</h3>

      {/* Task creation form */}
      <form onSubmit={handleCreateTask} style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          disabled={loading}
          style={{ flex: 1, minWidth: 120, padding: 8 }}
        />
        <input
          placeholder="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={loading}
          style={{ flex: 2, minWidth: 120, padding: 8 }}
        />
        <select
          value={assignee}
          onChange={e => setAssignee(e.target.value)}
          required
          disabled={loading}
          style={{ padding: 8, flexShrink: 0 }}
        >
          <option value="">Assign to...</option>
          {memberList.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          required
          disabled={loading}
          style={{ padding: 8, flexShrink: 0 }}
        />
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          disabled={loading}
          style={{ padding: 8, flexShrink: 0 }}
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <button type="submit" disabled={loading} style={{ cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Adding...' : 'Add Task'}
        </button>
      </form>

      {/* Display error message */}
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}

      {/* Tasks list */}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {loading && tasks.length === 0 ? (
          <li>Loading tasks...</li>
        ) : tasks.length === 0 ? (
          <li>No tasks found.</li>
        ) : (
          tasks.map(task => (
            <li key={task.id}
                style={{
                  marginBottom: 12,
                  background: '#f0f4ff',
                  padding: 12,
                  borderRadius: 6,
                  boxShadow: '1px 1px 4px rgba(0,0,0,0.05)'
                }}>
              <strong>{task.title}</strong> — Assigned to <em>{task.assignee}</em><br />
              <small>Status: {task.status}</small><br />
              <small>Deadline: {new Date(task.deadline || '').toLocaleString() || 'N/A'}</small>
              {task.description && <p style={{ whiteSpace: 'pre-wrap' }}>{task.description}</p>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
