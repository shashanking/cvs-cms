import { useRouter } from 'next/router';
import React from 'react';
import { useUser } from '../../../components/UserContext';
import { ProjectProvider } from '../../../components/ProjectContext';
import Notifications from '../../../components/Notifications';
import ProjectChat from '../../../components/ProjectChat';

// This page renders the full-page project chat for a given project ID.
// It ensures context providers are present, just like the main project page.

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const ProjectChatPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    const fetchProject = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      if (isMounted) {
        setProject(data || null);
        setLoading(false);
      }
    };
    fetchProject();
    return () => { isMounted = false; };
  }, [id]);

  if (!user || loading || !project) {
    return <div style={{textAlign: 'center', marginTop: 80}}>Loading chat...</div>;
  }

  return (
    <ProjectProvider initialProject={project}>
      <Notifications />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 0 24px 0' }}>
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#f8fafc',
          padding: '24px 0 8px 0',
          borderBottom: '1.5px solid #e5e7eb',
          marginBottom: 18
        }}>
          <button
            onClick={() => router.push(`/project/${id}`)}
            style={{ marginBottom: 12, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 500, color: '#2b6cb0', transition: 'background 0.2s' }}
            onMouseOver={e => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseOut={e => (e.currentTarget.style.background = '#f1f5f9')}
          >
            ← Back to Project
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: '2rem', color: '#3182ce', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #e3f0ff', padding: 6 }}>💬</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 22, color: '#2563eb', lineHeight: 1 }}>{project?.name || 'Project Chat'}</div>
              <div style={{ fontSize: 15, color: '#666', marginTop: 2 }}>{project?.description || 'Discuss and collaborate with your team here.'}</div>
            </div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 4px 24px rgba(44,62,80,0.08)', border: '1.5px solid #e3e7ef', marginTop: 18, padding: '0 0 8px 0', minHeight: 400 }}>
          {project ? <ProjectChat /> : <div style={{ padding: 32, color: '#888', textAlign: 'center' }}>Project info not found. Please return to the project page.</div>}
        </div>
      </div>
    </ProjectProvider>
  );
};

export default ProjectChatPage;
