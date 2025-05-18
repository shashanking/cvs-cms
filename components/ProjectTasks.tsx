import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';
import { v4 as uuidv4 } from 'uuid';

interface ProjectTasksProps {
  members?: string[]; // optional, for static member list
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  assignee: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
  deadline: string | null;
  is_deleted: boolean;
}

const DEFAULT_MEMBERS = [
  'vikash', 'rini', 'pradip', 'shashank', 'sahil', 'sayan'
];

function ProjectTasksComponent({ members }: ProjectTasksProps) {
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberList = members || DEFAULT_MEMBERS;

  const logAuditAction = async (action: string, taskId: string, details: any) => {
    try {
      await supabase.from('audit_logs').insert([{
        task_id: taskId,
        action,
        performed_by: user.username,
        details: { ...details, timestamp: new Date().toISOString() },
        created_at: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    setTasks(data || []);
    setLoading(false);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Project not loaded yet.');
      return;
    }
    if (!deadline) {
      setError('Deadline is required.');
      return;
    }
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.from('project_tasks').insert([
        {
          project_id: projectId,
          title,
          description,
          assignee,
          status,
          deadline,
          created_by: user.username
        }
      ]).select().single();

      if (error) throw error;
      
      // Log the creation in audit log and update UI optimistically
      // Update UI with the new task first for better UX
      setTasks(prev => [data, ...prev]);
      
      // Log the creation in audit log after UI update
      await logAuditAction('task_created', data.id, {
        title: data.title,
        description: data.description,
        assignee: data.assignee,
        status: data.status,
        deadline: data.deadline
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setAssignee('');
      setDeadline('');
      setStatus('open');
    } catch (error) {
      setError(error.message);
      console.error('Error creating task:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!projectId) return <div>Loading project tasks...</div>;
  return (
    <div style={{ margin: '4vw 0' }}>
      <h3 style={{ fontSize: '5vw', marginBottom: '3vw', color: '#2b6cb0' }}>Project Tasks</h3>
      <form onSubmit={handleCreateTask} style={{
        marginBottom: 20,
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
        background: '#fff',
        borderRadius: 8,
        padding: '3vw 2vw',
        boxShadow: '0 1px 6px rgba(44,62,80,0.08)'
      }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          required
          style={{ minWidth: 120, flex: 1, fontSize: '1rem', padding: 8, borderRadius: 6, border: '1px solid #cbd5e0' }}
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description"
          style={{ minWidth: 120, flex: 2, fontSize: '1rem', padding: 8, borderRadius: 6, border: '1px solid #cbd5e0' }}
        />
        <input
          type="datetime-local"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          placeholder="Deadline"
          required
          style={{ minWidth: 180, flex: 1, fontSize: '1rem', padding: 8, borderRadius: 6, border: '1px solid #cbd5e0' }}
        />
        <select
          value={assignee}
          onChange={e => setAssignee(e.target.value)}
          required
          style={{ fontSize: '1rem', padding: 8, borderRadius: 6, border: '1px solid #cbd5e0' }}
        >
          <option value="">Assign to...</option>
          {memberList.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{ fontSize: '1rem', padding: 8, borderRadius: 6, border: '1px solid #cbd5e0' }}
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <button type="submit" disabled={loading || !title || !assignee || !deadline} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Add Task</button>
      </form>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      <div>
        <h4>All Tasks</h4>
        {loading ? <div>Loading...</div> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tasks.map(task => (
              <TaskDetail
                key={task.id}
                task={task}
                user={user}
                members={memberList}
                onDelete={() => {
                  setTasks(prev => prev.filter(t => t.id !== task.id));
                }}
                logAuditAction={logAuditAction}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// --- TaskDetail component ---
type TaskDetailProps = {
  task: TaskItem;
  user: { username: string; display_name: string; role: string };
  members: string[];
  onDelete: () => void;
  logAuditAction: (action: string, taskId: string, details: any) => Promise<void>;
};


const TaskDetail: React.FC<TaskDetailProps> = ({ task, user, members, onDelete, logAuditAction }) => {
  const { project } = useProject();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [timeDesc, setTimeDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expanded) {
      fetchDetails();
    }
    // eslint-disable-next-line
  }, [expanded]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    const [cmt, tlog] = await Promise.all([
      supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at', { ascending: true }),
      supabase.from('task_logs').select('*').eq('task_id', task.id).order('created_at', { ascending: true })
    ]);
    if (cmt.error) setError(cmt.error.message);
    setComments(cmt.data || []);
    setTimeLogs(tlog.data || []);
    setLoading(false);
  };

  const handleAddComment = async () => {
    if (!commentText) return;
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert([
          { 
            task_id: task.id, 
            username: user.username, 
            comment: commentText,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Log comment in audit log
      await logAuditAction('task_comment_added', task.id, {
        comment_id: data.id,
        comment: data.comment
      });

      // Update UI optimistically
      setComments(prev => [...prev, data]);
      setCommentText('');
    } catch (error) {
      setError(error.message);
      console.error('Error adding comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTimeLog = async () => {
    if (!timeSpent) return;
    setLoading(true);
    setError(null);
    
    const project_id = project?.id;
    try {
      const { data, error } = await supabase
        .from('task_logs')
        .insert([
          { 
            task_id: task.id, 
            project_id,
            performed_by: user.username, 
            action: 'time_log',
            details: {
              minutes: Number(timeSpent),
              description: timeDesc
            },
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Log time entry in audit log
      await logAuditAction('task_time_logged', task.id, {
        time_log_id: data.id,
        minutes: data.details?.minutes,
        description: data.details?.description
      });

      // Update UI optimistically
      setTimeLogs(prev => [...prev, data]);
      setTimeSpent('');
      setTimeDesc('');
    } catch (error) {
      setError(error.message);
      console.error('Error logging time:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Log the deletion in audit log
      await logAuditAction('task_deleted', task.id, {
        title: task.title,
        description: task.description,
        assignee: task.assignee,
        status: task.status,
        deadline: task.deadline
      });

      // Soft delete: set is_deleted to true
      const { error: deleteError } = await supabase
        .from('project_tasks')
        .update({ is_deleted: true })
        .eq('id', task.id);

      if (deleteError) throw deleteError;

      // Call parent's onDelete to update the UI
      onDelete();
    } catch (error) {
      setError(error.message || 'Failed to delete task');
      console.error('Error deleting task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <li style={{ marginBottom: 10, background: '#f7fafc', borderRadius: 6, padding: 10, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{task.title}</strong>
          <span style={{ color: '#3182ce', fontSize: 13 }}>({task.status})</span><br />
          <span style={{ fontSize: 13 }}>{task.description}</span>
          {task.deadline && (
            <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
              Deadline: {new Date(task.deadline).toLocaleString()}
            </div>
          )}
          <span style={{ fontSize: 12, color: '#666' }}>Assignee: {task.assignee} | Created by {task.created_by} at {new Date(task.created_at).toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setExpanded(e => !e)} 
            style={{ 
              background: '#3182ce', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              padding: '4px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {expanded ? 'Hide' : 'Details'}
            {expanded ? '▲' : '▼'}
          </button>
          <button 
            onClick={handleDeleteTask} 
            disabled={loading}
            style={{ 
              background: '#ef4444', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              padding: '4px 12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {loading ? 'Deleting...' : (
              <>
                <span>🗑️</span> Delete
              </>
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 16, background: '#fff', borderRadius: 6, padding: 12, border: '1px solid #e2e8f0' }}>
          {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
          <h5>Comments</h5>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {comments.map(c => (
              <li key={c.id} style={{ marginBottom: 6, background: '#edf2f7', borderRadius: 4, padding: 6 }}>
                <span style={{ fontWeight: 600 }}>{c.username}</span>: {c.comment}
                <span style={{ marginLeft: 10, color: '#888', fontSize: 12 }}>{new Date(c.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); handleAddComment(); }} style={{ marginBottom: 16 }}>
            <input 
              value={commentText} 
              onChange={e => setCommentText(e.target.value)} 
              placeholder="Add a comment..." 
              style={{ minWidth: 180, marginRight: 8 }} 
            />
            <button type="submit" disabled={loading || !commentText}>Comment</button>
          </form>
          <h5 style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            Time Logs
            <button 
              type="button"
              onClick={fetchDetails} 
              style={{ marginLeft: 8, fontSize: 13, background: '#facc15', color: '#333', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
            >
              Refresh
            </button>
          </h5>
          {timeLogs.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13, marginBottom: 6 }}>No time logs for this task yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {timeLogs.map(t => (
                <li key={t.id} style={{ marginBottom: 6, background: '#e6fffa', borderRadius: 4, padding: 6, display: 'flex', flexDirection: 'column' }}>
                  <span>
                    <span style={{ fontWeight: 600 }}>{t.performed_by}</span>: <span style={{ color: '#ca8a04' }}>{t.details?.minutes} min</span>
                    {t.details?.description && <span style={{ color: '#666', marginLeft: 8 }}>({t.details?.description})</span>}
                  </span>
                  <span style={{ marginLeft: 2, color: '#888', fontSize: 12 }}>{new Date(t.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleAddTimeLog(); }}>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input 
                type="number" 
                min="1" 
                value={timeSpent} 
                onChange={e => setTimeSpent(e.target.value)} 
                placeholder="Minutes" 
                style={{ width: 80 }} 
              />
              <input 
                value={timeDesc} 
                onChange={e => setTimeDesc(e.target.value)} 
                placeholder="Description (optional)" 
                style={{ minWidth: 120 }} 
              />
              <button type="submit" disabled={loading || !timeSpent}>Log Time</button>
            </div>
          </form>
        </div>
      )}
    </li>
  );
};

export default ProjectTasksComponent;
