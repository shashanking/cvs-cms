import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { project_id, folder, file_name, downloaded_by, downloaded_at, uploaded_by } = req.body;
  if (!project_id || !folder || !file_name || !downloaded_by || !downloaded_at) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // For multi-user tracking, use downloaded_by_users: { username, downloaded_at }[]
  // (You must add this column to your table: downloaded_by_users jsonb[])

  // Try to find an existing download log for this file
  const { data: existing, error: fetchError } = await supabase
    .from('file_upload_audit')
    .select('id, downloaded_by_users, uploaded_by')
    .eq('project_id', project_id)
    .eq('folder', folder)
    .eq('file_name', file_name)
    .eq('action', 'download');
  if (fetchError) return res.status(500).json({ error: fetchError.message });

  // Ensure uploader is not counted in downloaded_by
  let actualUploader = uploaded_by;
  if (!actualUploader) {
    // Try to fetch uploader from upload log if not provided
    const { data: uploadLog } = await supabase
      .from('file_upload_audit')
      .select('uploaded_by')
      .eq('project_id', project_id)
      .eq('folder', folder)
      .eq('file_name', file_name)
      .eq('action', 'upload')
      .single();
    actualUploader = uploadLog?.uploaded_by;
  }

  if (existing && existing.length > 0) {
    // Already logged, update array if needed
    const log = existing[0];
    let downloadedArr = Array.isArray(log.downloaded_by_users) ? log.downloaded_by_users : [];
    // Only add if not already present (no duplicate logs per user)
    if (downloaded_by !== actualUploader && !downloadedArr.some((entry: any) => entry.username === downloaded_by)) {
      downloadedArr.push({ username: downloaded_by, downloaded_at });
      const { error: updateError } = await supabase
        .from('file_upload_audit')
        .update({ downloaded_by_users: downloadedArr, action: 'download' })
        .eq('id', log.id);
      if (updateError) return res.status(500).json({ error: updateError.message });
      return res.status(200).json({ updated: true });
    }
    // No update needed (user already present)
    return res.status(200).json({ already_downloaded: true });
  } else {
    // Insert new download log ONLY if no row exists
    let arr: any[] = [];
    if (downloaded_by !== actualUploader) arr = [{ username: downloaded_by, downloaded_at }];
    const { error } = await supabase.from('file_upload_audit').insert([
      { project_id, folder, file_name, downloaded_by_users: arr, action: 'download' }
    ]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
}
