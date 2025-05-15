import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ProjectTasksProps {
  projectId: string;
  user: { username: string; role: string };
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
}

const DEFAULT_MEMBERS = [
  'vikash', 'rini', 'pradip', 'shashank', 'sahil', 'sayan'
];

const ProjectTasks: React.FC<ProjectTasksProps> = ({ projectId, user, members }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberList = members || DEFAULT_MEMBERS;

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    setTasks(data || []);
    setLoading(false);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('project_tasks').insert([
      {
        project_id: projectId,
        title,
        description,
        assignee,
        status,
        created_by: user.username
      }
    ]);
    if (error) setError(error.message);
    setTitle('');
    setDescription('');
    setAssignee('');
    setStatus('open');
    fetchTasks();
    setLoading(false);
  };

  return (
    <div style={{ margin: '4vw 0' }}>
      <h3 style={{ fontSize: '5vw', marginBottom: '3vw', color: '#2b6cb0' }}>Project Tasks</h3>
      <form onSubmit={handleCreateTask} style={{
        marginBottom: 20,
        display: 'flex',
        gap: '2vw',
        flexWrap: 'wrap',
        alignItems: 'center',
        background: '#fff',
        borderRadius: 8,
        padding: '3vw 2vw',
        boxShadow: '0 1px 6px rgba(44,62,80,0.08)'
      }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" required style={{ minWidth: 120, flex: 1, fontSize: '4vw', padding: '2vw', borderRadius: 6, border: '1px solid #cbd5e0' }} />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" style={{ minWidth: 120, flex: 2, fontSize: '4vw', padding: '2vw', borderRadius: 6, border: '1px solid #cbd5e0' }} />
        <select value={assignee} onChange={e => setAssignee(e.target.value)} required style={{ fontSize: '4vw', padding: '2vw', borderRadius: 6, border: '1px solid #cbd5e0' }}>
          <option value="">Assign to...</option>
          {memberList.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ fontSize: '4vw', padding: '2vw', borderRadius: 6, border: '1px solid #cbd5e0' }}>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <button type="submit" disabled={loading} style={{ fontSize: '4vw', padding: '2vw 4vw', borderRadius: 6, background: '#3182ce', color: '#fff', border: 'none' }}>Create Task</button>
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
  user: { username: string; role: string };
  members: string[];
};

const TaskDetail: React.FC<TaskDetailProps> = ({ task, user, members }) => {
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
      supabase.from('task_time_logs').select('*').eq('task_id', task.id).order('created_at', { ascending: true })
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
    const { error } = await supabase.from('task_comments').insert([
      { task_id: task.id, username: user.username, comment: commentText }
    ]);
    if (error) setError(error.message);
    setCommentText('');
    fetchDetails();
    setLoading(false);
  };

  const handleAddTimeLog = async () => {
    if (!timeSpent) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.from('task_time_logs').insert([
      { task_id: task.id, username: user.username, time_spent_minutes: Number(timeSpent), description: timeDesc }
    ]);
    if (error) setError(error.message);
    setTimeSpent('');
    setTimeDesc('');
    fetchDetails();
    setLoading(false);
  };

  return (
    <li style={{ marginBottom: 10, background: '#f7fafc', borderRadius: 6, padding: 10, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{task.title}</strong> <span style={{ color: '#888', fontSize: 13 }}>({task.status})</span><br />
          <span style={{ fontSize: 13 }}>{task.description}</span><br />
          <span style={{ fontSize: 12, color: '#666' }}>Assignee: {task.assignee} | Created by {task.created_by} at {new Date(task.created_at).toLocaleString()}</span>
        </div>
        <button onClick={() => setExpanded(e => !e)} style={{ marginLeft: 16 }}>{expanded ? 'Hide' : 'Details'}</button>
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
          <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..." style={{ minWidth: 180 }} />
          <button onClick={handleAddComment} disabled={loading || !commentText}>Comment</button>
          <h5 style={{ marginTop: 18 }}>Time Logs</h5>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {timeLogs.map(t => (
              <li key={t.id} style={{ marginBottom: 6, background: '#e6fffa', borderRadius: 4, padding: 6 }}>
                <span style={{ fontWeight: 600 }}>{t.username}</span>: {t.time_spent_minutes} min
                {t.description && <span style={{ color: '#666', marginLeft: 8 }}>({t.description})</span>}
                <span style={{ marginLeft: 10, color: '#888', fontSize: 12 }}>{new Date(t.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <input type="number" min="1" value={timeSpent} onChange={e => setTimeSpent(e.target.value)} placeholder="Minutes" style={{ width: 80 }} />
          <input value={timeDesc} onChange={e => setTimeDesc(e.target.value)} placeholder="Description (optional)" style={{ minWidth: 120 }} />
          <button onClick={handleAddTimeLog} disabled={loading || !timeSpent}>Log Time</button>
        </div>
      )}
    </li>
  );
};

export default ProjectTasks;
