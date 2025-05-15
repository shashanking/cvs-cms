import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

// Create an event notification for all users except creator
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { project_id, event_id, event_topic, created_by, all_usernames } = req.body;
    if (!project_id || !event_id || !event_topic || !created_by || !Array.isArray(all_usernames)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Insert a notification for each user except the creator
    const notifications = all_usernames
      .filter(username => username !== created_by)
      .map(username => ({
        project_id,
        event_id,
        event_topic,
        username,
        read: false,
        created_at: new Date().toISOString()
      }));
    const { error } = await supabase.from('event_notifications').insert(notifications);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ success: true });
  }
  res.setHeader('Allow', ['POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
