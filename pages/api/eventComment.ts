import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

// Add a comment or check-in to an event
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { event_id, username, comment, check_in } = req.body;
    if (!event_id || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { data, error } = await supabase.from('event_comments').insert([
      { event_id, username, comment, check_in: !!check_in }
    ]);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    // Mark event notification as read if this is a check-in
    if (check_in) {
      await supabase
        .from('event_notifications')
        .update({ read: true })
        .eq('event_id', event_id)
        .eq('username', username);
    }
    return res.status(201).json({ success: true, comment: data });
  }
  res.setHeader('Allow', ['POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
