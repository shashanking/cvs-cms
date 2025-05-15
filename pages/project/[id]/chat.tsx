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
      <ProjectChat />
    </ProjectProvider>
  );
};

export default ProjectChatPage;
