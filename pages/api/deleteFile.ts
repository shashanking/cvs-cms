import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { project_id, folder, file_path, deleted_by, deleted_at } = req.body;
  if (!project_id || !folder || !file_path || !deleted_by || !deleted_at) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Delete file from Supabase Storage
  const { error: delError } = await supabase.storage.from('media').remove([file_path]);
  if (delError) return res.status(500).json({ error: delError.message });
  // Track deletion in audit table
  const { error: auditError } = await supabase.from('file_upload_audit').insert([
    { project_id, folder, file_name: file_path.split('/').pop(), deleted_by, deleted_at, action: 'file_deleted' }
  ]);
  if (auditError) return res.status(500).json({ error: auditError.message });
  return res.status(200).json({ success: true });
}
