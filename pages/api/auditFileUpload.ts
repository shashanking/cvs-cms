import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { project_id, folder, file_name, uploaded_by, uploaded_at, deleted_by, deleted_at, action } = req.body;
  if (!project_id || !folder || !file_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (action === 'delete' || action === 'link_deleted') {
    if (!deleted_by || !deleted_at) {
      return res.status(400).json({ error: 'Missing deleted_by or deleted_at' });
    }
    const { url, type, is_google_link } = req.body;
    const { error } = await supabase.from('file_upload_audit').insert([
      { project_id, folder, file_name, deleted_by, deleted_at, action: 'link_deleted', url, type, is_google_link }
    ]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  if (!uploaded_by || !uploaded_at) {
    return res.status(400).json({ error: 'Missing uploaded_by or uploaded_at' });
  }
  const { error } = await supabase.from('file_upload_audit').insert([
    { project_id, folder, file_name, uploaded_by, uploaded_at, action: 'upload' }
  ]);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
