import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import CreateProjectForm from '../components/CreateProjectForm';
import LoginForm from '../components/LoginForm';
import ProjectFolders from '../components/ProjectFolders';
import ProjectTasks from '../components/ProjectTasks';

// AssignedTasksSection: Shows all tasks assigned to the user (not completed) from all projects

const AssignedTasksSection: React.FC<{ user: { username: string; role: string } }> = ({ user }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.username) return;
    fetchAssignedTasks();
    // eslint-disable-next-line
  }, [user?.username]);

  const fetchAssignedTasks = async () => {
    setLoading(true);
    setError(null);
    // Get all non-completed tasks assigned to this user
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*, projects(name)')
      .eq('assignee', user.username)
      .neq('status', 'closed')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    setTasks(data || []);
    setLoading(false);
  };

  const handleMarkCompleted = async (taskId: string) => {
    setLoading(true);
    await supabase.from('project_tasks').update({ status: 'closed' }).eq('id', taskId);
    fetchAssignedTasks();
    setLoading(false);
  };

  if (!user?.username) return null;
  return (
    <div style={{ marginBottom: 32, background: '#f7fafc', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
      <h2 style={{ marginTop: 0 }}>My Assigned Tasks</h2>
      {loading ? <div>Loading...</div> : (
        tasks.length === 0 ? <div style={{ color: '#888' }}>No assigned tasks!</div> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tasks.map((task: any) => (
              <li key={task.id} style={{ marginBottom: 10, background: '#fff', borderRadius: 6, padding: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{task.title}</strong> <span style={{ color: '#3182ce', fontSize: 13 }}>({task.projects?.name || 'Unknown Project'})</span><br />
                  <span style={{ fontSize: 13 }}>{task.description}</span>
                </div>
                <button onClick={() => handleMarkCompleted(task.id)} style={{ background: '#38a169', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer' }}>Mark Completed</button>
              </li>
            ))}
          </ul>
        )
      )}
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
};

const FOLDER_LIST = ["finance", "tech", "invoices", "proposals", "reports", "media", "others"];

export default function Home() {
  const logout = () => {
    setUser(null);
    localStorage.removeItem('cvs-cms-user');
  };

  const [user, setUser] = useState<{ username: string, role: string } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  // Account persistence: load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('cvs-cms-user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
  }, []);

  // Load all projects on initial load if user is logged in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (!error) setProjects(data || []);
    })();
  }, [user]);

  const handleProjectCreated = (project: any) => {
    setProjects(prev => [project, ...prev]);
  };

  return (
    <main style={{
      padding: '4vw 2vw',
      maxWidth: 900,
      margin: '0 auto',
      boxSizing: 'border-box',
      fontFamily: 'Inter, Arial, sans-serif',
      background: '#f9fafb',
      minHeight: '100vh'
    }}>
      <h1 style={{ fontSize: '7vw', margin: '4vw 0 2vw 0', textAlign: 'center', color: '#2b6cb0', letterSpacing: 1 }}>CVS CMS Dashboard</h1>
      {user ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4vw' }}>
          {/* Assigned Tasks Card */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(44,62,80,0.08)', padding: '4vw', marginBottom: '2vw' }}>
            <h2 style={{ color: '#2b6cb0', fontSize: '5vw', margin: 0, marginBottom: '2vw', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span role="img" aria-label="tasks">📝</span> My Assigned Tasks
            </h2>
            <AssignedTasksSection user={user} />
          </div>
          {/* User Info Card */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(44,62,80,0.08)', padding: '4vw', marginBottom: '2vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: 500, fontSize: '4vw', margin: 0 }}>Welcome, {user.role} ({user.username})</p>
            <button
              style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer' }}
              onClick={logout}
            >
              Logout
            </button>
          </div>
          {/* Project Section Card */}
          {selectedProject ? (
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(44,62,80,0.08)', padding: '4vw', marginBottom: '2vw' }}>
              <h2 style={{ color: '#2b6cb0', fontSize: '5vw', margin: 0, marginBottom: '2vw', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span role="img" aria-label="project">📁</span> Project: <span style={{ fontWeight: 500 }}>{selectedProject.name}</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3vw' }}>
                <div style={{ background: '#f7fafc', borderRadius: 8, padding: '3vw 2vw', boxShadow: '0 1px 6px rgba(44,62,80,0.04)' }}>
                  <ProjectFolders projectId={selectedProject.id} user={user} folders={FOLDER_LIST} />
                </div>
                <div style={{ background: '#f7fafc', borderRadius: 8, padding: '3vw 2vw', boxShadow: '0 1px 6px rgba(44,62,80,0.04)' }}>
                  <ProjectTasks projectId={selectedProject.id} user={user} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(44,62,80,0.08)', padding: '4vw', marginBottom: '2vw' }}>
              <h2 style={{ color: '#2b6cb0', fontSize: '5vw', margin: 0, marginBottom: '2vw', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span role="img" aria-label="project">📁</span> Select a Project
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {projects.map(project => (
                  <li key={project.id} style={{ marginBottom: 14 }}>
                    <button
                      style={{ background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '4vw', fontWeight: 500 }}
                      onClick={() => setSelectedProject(project)}
                    >
                      {project.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <LoginForm onLogin={setUser} />
      )}
    </main>
  );
}
