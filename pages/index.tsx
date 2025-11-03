import React, { useEffect, useState } from 'react';
import { useUser } from '../components/UserContext';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import CreateProjectForm from '../components/CreateProjectForm';
import LoginForm from '../components/LoginForm';
import ProjectFolders from '../components/ProjectFolders';
import ProjectTasks from '../components/ProjectTasks';
import UniversalCalendar from '../components/UniversalCalendar';
import FolderIcon from '@mui/icons-material/Folder';

// AssignedTasksSection: Shows all tasks assigned to the user (not completed) from all projects
const AssignedTasksSection: React.FC<{ user: { username: string; role: string } }> = ({ user }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.username) return;
    fetchAssignedTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const fetchAssignedTasks = async () => {
    setLoading(true);
    setError(null);
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
      {loading ? (
        <div>Loading...</div>
      ) : tasks.length === 0 ? (
        <div style={{ color: '#888' }}>No assigned tasks!</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {tasks.map((task: any) => (
            <li
              key={task.id}
              style={{
                marginBottom: 10,
                background: '#fff',
                borderRadius: 6,
                padding: 10,
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>{task.title}</strong>{' '}
                <span style={{ color: '#3182ce', fontSize: 13 }}>
                  ({task.projects?.name || 'Unknown Project'})
                </span>
                <br />
                <span style={{ fontSize: 13 }}>{task.description}</span>
              </div>
              <button
                onClick={() => handleMarkCompleted(task.id)}
                style={{
                  background: '#38a169',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
              >
                Mark Completed
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
};

const FOLDER_LIST = ['finance', 'tech', 'invoices', 'proposals', 'reports', 'media', 'others'];

export default function Home() {
  const { user, setUser } = useUser();

  // If you handle logout globally via TopBar, remove this.
  // Included here only if you want a local logout button.
  const logout = () => {
    setUser(null);
    localStorage.removeItem('cvs-cms-user');
  };

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setProjects(data || []);
    })();
  }, [user]);

  const handleProjectCreated = (project: any) => {
    setProjects((prev) => [project, ...prev]);
  };

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <main
      className="cvs-main"
      style={{
        padding: '4vw 2vw',
        maxWidth: 900,
        margin: '0 auto',
        boxSizing: 'border-box',
        fontFamily: 'Inter, Arial, sans-serif',
        background: '#f9fafb',
        minHeight: '100vh',
      }}
    >
      <h1
        className="dashboard-header"
        style={{
          fontSize: '7vw',
          margin: '4vw 0 2vw 0',
          textAlign: 'center',
          color: '#2b6cb0',
          letterSpacing: 1,
        }}
      >
        CVS CMS Dashboard
      </h1>

      <UniversalCalendar />
      <div style={{ height: 32 }} />

      <div className="desktop-flex-col" style={{ display: 'flex', flexDirection: 'column', gap: '4vw' }}>
        {/* Assigned Tasks */}
        <div
          className="tasks-card"
          style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(44,62,80,0.08)',
            padding: '4vw',
            marginBottom: '2vw',
          }}
        >
          <h2
            style={{
              color: '#2b6cb0',
              fontSize: '5vw',
              margin: 0,
              marginBottom: '2vw',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span role="img" aria-label="tasks">
              📝
            </span>{' '}
            My Assigned Tasks
          </h2>
          <AssignedTasksSection user={user} />
        </div>

        {/* Create New Project Form */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(44,62,80,0.08)',
            padding: '4vw',
            marginBottom: '2vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <CreateProjectForm onCreated={handleProjectCreated} />
        </div>

        {/* Projects section */}
        {!selectedProject ? (
          <div
            className="project-list"
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 2px 12px rgba(44,62,80,0.08)',
              padding: '12vw',
              paddingTop: '2vw',
              paddingBottom: '2vw',
              paddingLeft: '12vw',
              paddingRight: '12vw',
              marginBottom: '2vw',
              width: '100%',
              maxWidth: 900,
              margin: '0 auto',
            }}
          >
            {/* Projects heading with folder icon at the top */}
            <div>
              <h2
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#222',
                  fontWeight: 700,
                  fontSize: '2rem',
                  marginBottom: '2rem',
                  gap: 12,
                }}
              >
                <FolderIcon style={{ fontSize: 32, color: '#444' }} />
                Projects
              </h2>
            </div>

            {/* Project buttons grid */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 24,
                justifyContent: 'center',
                width: '100%',
              }}
            >
              {projects.map((project) => (
                <Link key={project.id} href={`/project/${project.id}`} style={{ textDecoration: 'none' }}>
                  <button
                    style={{
                      background: '#3182ce',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '16px 36px',
                      cursor: 'pointer',
                      fontSize: 18,
                      fontWeight: 600,
                      minWidth: 180,
                      maxWidth: 260,
                      marginBottom: 10,
                      whiteSpace: 'nowrap',
                      transition: 'background 0.25s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = '#2563eb')}
                    onMouseOut={(e) => (e.currentTarget.style.background = '#3182ce')}
                  >
                    {project.name}
                  </button>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          // Selected Project Details View
          <div
            className="project-card"
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 2px 12px rgba(44,62,80,0.08)',
              padding: '4vw',
              marginBottom: '2vw',
            }}
          >
            <h2
              style={{
                color: '#2b6cb0',
                fontSize: '5vw',
                margin: 0,
                marginBottom: '2vw',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span role="img" aria-label="project">
                📁
              </span>{' '}
              Project: <span style={{ fontWeight: 500 }}>{selectedProject.name}</span>
            </h2>
            <div className="desktop-flex-col" style={{ display: 'flex', flexDirection: 'column', gap: '3vw' }}>
              <div
                className="folders-section"
                style={{
                  background: '#f7fafc',
                  borderRadius: 8,
                  padding: '3vw 2vw',
                  boxShadow: '0 1px 6px rgba(44,62,80,0.04)',
                }}
              >
                <ProjectFolders folders={FOLDER_LIST} />
              </div>
              <div
                className="tasks-section"
                style={{
                  background: '#f7fafc',
                  borderRadius: 8,
                  padding: '3vw 2vw',
                  boxShadow: '0 1px 6px rgba(44,62,80,0.04)',
                }}
              >
                <ProjectTasks />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
