import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { project_id, folder, file_name, uploaded_by, uploaded_at } = req.body;
  if (!project_id || !folder || !file_name || !uploaded_by || !uploaded_at) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Insert into audit table (make sure you have created this table in Supabase)
  const { error } = await supabase.from('file_upload_audit').insert([
    { project_id, folder, file_name, uploaded_by, uploaded_at, action: 'upload' }
  ]);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
