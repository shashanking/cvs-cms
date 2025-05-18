import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';

type ActivityLog = {
  id: string;
  type: 'event' | 'task';
  action: string;
  performed_by: string;
  created_at: string;
  details: any;
  reference_id: string | number;
  title?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { projectId } = req.query;

  if (!projectId || Array.isArray(projectId)) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  try {
    // Fetch event logs
    const { data: eventLogs = [], error: eventError } = await supabase
      .from('event_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (eventError) throw eventError;

    // Fetch task logs
    const { data: taskLogs = [], error: taskError } = await supabase
      .from('task_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (taskError) throw taskError;

    // Transform logs into a unified format
    const transformLogs = (logs: any[], type: 'event' | 'task'): ActivityLog[] => {
      return logs.map(log => ({
        id: log.id,
        type,
        action: log.action,
        performed_by: log.performed_by,
        created_at: log.created_at,
        details: log.details,
        reference_id: type === 'event' ? log.event_id : log.task_id,
        title:
          log.action === 'time_log' ? 'Time Log' :
          (log.action === 'comment' && log.details?.title) ? log.details.title : (log.details?.title || log.details?.event_topic || `Untitled ${type}`)
      }));
    };

    // Only include relevant actions for task logs (including time_log)
    const filteredTaskLogs = (taskLogs || []).filter(log =>
      log.action === 'time_log' || log.action === 'created' || log.action === 'updated' || log.action === 'deleted' || log.action === 'comment'
    );

    const allLogs = [
      ...transformLogs(eventLogs, 'event'),
      ...transformLogs(filteredTaskLogs, 'task')
    ].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return res.status(200).json({ logs: allLogs });
  } catch (error) {
    console.error('Error fetching project logs:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch project logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
