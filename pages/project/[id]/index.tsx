import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import { useUser } from '../../../components/UserContext';
import { ProjectProvider, useProject } from '../../../components/ProjectContext';
import { supabase } from '../../../lib/supabaseClient';
import ProjectFolders from '../../../components/ProjectFolders';
import ProjectTasks from '../../../components/ProjectTasks';
import { ProjectEventsComponent } from '../../../components/ProjectEvents';
import ProjectMembers from '../../../components/ProjectMembers';
import Notifications from '../../../components/Notifications';
import ProjectChatButton from '../../../components/ProjectChatButton';
import ProjectChatNotification from '../../../components/ProjectChatNotification';
// import { ProjectAuditLogs } from '../../../components/ProjectAuditLogs';
import { ProjectActivityLogs } from '../../../components/ProjectActivityLogs';

const FOLDER_LIST = ["finance", "tech", "invoices", "proposals", "reports", "media", "others"];

// Helper to set project in context after fetch
const ProjectContextSetter: React.FC<{ project: any }> = ({ project }) => {
  const { setProject } = useProject();
  useEffect(() => {
    setProject(project);
  }, [project, setProject]);
  return null;
};

const ProjectPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const { setUser } = useUser();

  const handleBack = () => {
    try {
      const stored = localStorage.getItem('cvs-cms-user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUser(parsed);
        } catch {}
      }
    } catch {}
    router.push('/');
  };

  useEffect(() => {
    if (!id) return;
    const fetchProject = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        setError(error.message);
      } else {
        setProject(data);
      }
      setLoading(false);
    };
    fetchProject();
  }, [id]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>;
  if (!project) return <div style={{ padding: 24 }}>Project not found.</div>;

  const tabConfig = [
    { id: 'tasks', icon: '✅', label: 'Tasks', component: <ProjectTasks /> },
    { id: 'events', icon: '📅', label: 'Events', component: <ProjectEventsComponent /> },
    { id: 'activity', icon: '📝', label: 'Activity', component: <ProjectActivityLogs /> },
  ];

  return (
    <ProjectProvider>
      <ProjectContextSetter project={project} />
      <Notifications />
      <main className="cvs-main" style={{
        padding: '4vw 2vw',
        maxWidth: 900,
        margin: '0 auto',
        boxSizing: 'border-box',
        fontFamily: 'Inter, Arial, sans-serif',
        background: '#f9fafb',
        minHeight: '100vh'
      }}>
        <button
          onClick={handleBack}
          style={{
            marginBottom: 18,
            background: '#f1f5f9',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            cursor: 'pointer',
            fontWeight: 500,
            color: '#2b6cb0',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#e2e8f0')}
          onMouseOut={e => (e.currentTarget.style.background = '#f1f5f9')}
        >
          ← Back to Project List
        </button>

        {/* Project Header */}
        <div className="project-card" style={{
          background: 'linear-gradient(90deg, #e3f0ff 0%, #f9fafb 100%)',
          borderRadius: 18,
          boxShadow: '0 4px 24px rgba(44,62,80,0.10)',
          padding: '5vw 4vw 4vw 4vw',
          marginBottom: '4vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '1vw',
          border: '1.5px solid #c3dafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span style={{
              fontSize: '2.5rem',
              color: '#3182ce',
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 2px 8px #e3f0ff',
              padding: 8
            }}>
              📁
            </span>
            <h1 style={{ color: '#2b6cb0', fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>
              {project.name}
            </h1>
          </div>
          <p style={{ color: '#444', fontSize: '1.1rem', margin: '0.5vw 0 0 0', fontWeight: 500 }}>
            {project.description}
          </p>
          <div style={{ fontSize: 15, color: '#6b7280', marginTop: 6, fontWeight: 400 }}>
            Created by: <span style={{ color: '#2563eb', fontWeight: 600 }}>{project.created_by}</span>
            &nbsp;|&nbsp; {new Date(project.created_at).toLocaleString()}
          </div>
        </div>

        <div style={{ height: '1.5px', background: '#e5e7eb', margin: '2vw 0 4vw 0', borderRadius: 2 }} />

        {/* Folders Section */}
        <div className="folders-section" style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(44,62,80,0.10)',
          padding: '4vw',
          marginBottom: '3vw',
          transition: 'box-shadow 0.2s',
          border: '1.5px solid #e3e7ef'
        }}>
          <h2 style={{
            color: '#2563eb',
            fontSize: '1.5rem',
            margin: 0,
            marginBottom: '2vw',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 700
          }}>
            <span style={{ fontSize: '1.5rem' }}>🗂️</span> Folders
          </h2>
          <ProjectFolders folders={FOLDER_LIST} />

      {/* Tabs Navigation */}
      <div style={{
        marginBottom: '3vw',
        display: 'flex',
        gap: '1vw',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '1vw',
        flexWrap: 'wrap'
      }}>
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.id ? '#2563eb' : '#f1f5f9',
              color: activeTab === tab.id ? 'white' : '#4b5563',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ marginBottom: '3vw' }}>
        {tabConfig.map((tab) => (
          activeTab === tab.id && (
            <div key={tab.id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(44,62,80,0.10)', padding: '4vw', marginTop: '1.5vw', border: '1.5px solid #e3e7ef' }}>
              <h2 style={{ color: '#2563eb', fontSize: '1.5rem', margin: 0, marginBottom: '2vw', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                <span style={{ fontSize: '1.5rem' }}>{tab.icon}</span> {tab.label}
              </h2>
              {tab.component}
            </div>
          )
        ))}
      </div>
        </div>

        
      </main>
        <ProjectChatNotification />
        <ProjectChatButton />
      </ProjectProvider>
    
  );
};


export default ProjectPage;
