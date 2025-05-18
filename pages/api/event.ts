import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

// Create or log an event for a project
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { project_id, topic, description, datetime, repeat, created_by } = req.body;
    if (!project_id || !topic || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Insert the event and return the inserted row (with id)
    const { data: event, error } = await supabase.from('project_events')
      .insert([{ project_id, topic, description, datetime, repeat, created_by }])
      .select()
      .single();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    // Log event creation in event_logs (for Activity Logs)
    console.log('[DEBUG] Logging event creation:', { event_id: event.id, action: 'created' });

    return res.status(201).json({ success: true, event });
  }
  res.setHeader('Allow', ['POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
