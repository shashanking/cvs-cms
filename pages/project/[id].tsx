import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ProjectFolders from '../../components/ProjectFolders';
import ProjectTasks from '../../components/ProjectTasks';

const FOLDER_LIST = ["finance", "tech", "invoices", "proposals", "reports", "media", "others"];

const ProjectPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchProject = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) setError(error.message);
      setProject(data);
      setLoading(false);
    };
    fetchProject();
  }, [id]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>;
  if (!project) return <div style={{ padding: 24 }}>Project not found.</div>;

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
      <button onClick={() => router.push('/')} style={{ marginBottom: 18, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 500, color: '#2b6cb0', transition: 'background 0.2s' }}
        onMouseOver={e => (e.currentTarget.style.background = '#e2e8f0')}
        onMouseOut={e => (e.currentTarget.style.background = '#f1f5f9')}
      >
        ← Back to Dashboard
      </button>
      <div style={{ background: 'linear-gradient(90deg, #e3f0ff 0%, #f9fafb 100%)', borderRadius: 18, boxShadow: '0 4px 24px rgba(44,62,80,0.10)', padding: '5vw 4vw 4vw 4vw', marginBottom: '4vw', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1vw', border: '1.5px solid #c3dafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ fontSize: '2.5rem', color: '#3182ce', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #e3f0ff', padding: 8 }}>📁</span>
          <h1 style={{ color: '#2b6cb0', fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>{project.name}</h1>
        </div>
        <p style={{ color: '#444', fontSize: '1.1rem', margin: '0.5vw 0 0 0', fontWeight: 500 }}>{project.description}</p>
        <div style={{ fontSize: 15, color: '#6b7280', marginTop: 6, fontWeight: 400 }}>Created by: <span style={{ color: '#2563eb', fontWeight: 600 }}>{project.created_by}</span> &nbsp;|&nbsp; {new Date(project.created_at).toLocaleString()}</div>
      </div>
      <div style={{height: '1.5px', background: '#e5e7eb', margin: '2vw 0 4vw 0', borderRadius: 2}} />

      {/* Folders Section */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(44,62,80,0.10)', padding: '4vw', marginBottom: '3vw', transition: 'box-shadow 0.2s', border: '1.5px solid #e3e7ef' }}>
        <h2 style={{ color: '#2563eb', fontSize: '1.5rem', margin: 0, marginBottom: '2vw', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
          <span style={{ fontSize: '1.5rem' }}>🗂️</span> Folders
        </h2>
        <ProjectFolders projectId={project.id} user={{ username: project.created_by, role: 'owner' }} folders={FOLDER_LIST} />
      </div>

      {/* Tasks Section */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(44,62,80,0.10)', padding: '4vw', marginBottom: '3vw', transition: 'box-shadow 0.2s', border: '1.5px solid #e3e7ef' }}>
        <h2 style={{ color: '#2563eb', fontSize: '1.5rem', margin: 0, marginBottom: '2vw', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
          <span style={{ fontSize: '1.5rem' }}>✅</span> Tasks
        </h2>
        <ProjectTasks projectId={project.id} user={{ username: project.created_by, role: 'owner' }} />
      </div>

      {/* Placeholder: Events and Members */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(44,62,80,0.10)', padding: '4vw', marginBottom: '3vw', transition: 'box-shadow 0.2s', border: '1.5px solid #e3e7ef' }}>
        <h2 style={{ color: '#2563eb', fontSize: '1.5rem', margin: 0, marginBottom: '2vw', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
          <span style={{ fontSize: '1.5rem' }}>📅</span> Events
        </h2>
        <div style={{ color: '#888', fontSize: '1rem', fontWeight: 500 }}>[Events section coming soon]</div>
      </div>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(44,62,80,0.10)', padding: '4vw', marginBottom: '3vw', transition: 'box-shadow 0.2s', border: '1.5px solid #e3e7ef' }}>
        <h2 style={{ color: '#2563eb', fontSize: '1.5rem', margin: 0, marginBottom: '2vw', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
          <span style={{ fontSize: '1.5rem' }}>👥</span> Members
        </h2>
        <div style={{ color: '#888', fontSize: '1rem', fontWeight: 500 }}>[Members section coming soon]</div>
      </div>
    </main>
  );
};

export default ProjectPage;
