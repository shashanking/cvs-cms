import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { project_id, folder, file_name, previewed_by, previewed_at } = req.body;
  if (!project_id || !folder || !file_name || !previewed_by || !previewed_at) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Try to find an existing preview log for this file
  const { data: existing, error: fetchError } = await supabase
    .from('file_upload_audit')
    .select('id, viewed_by_users')
    .eq('project_id', project_id)
    .eq('folder', folder)
    .eq('file_name', file_name)
    .eq('action', 'preview');

  if (fetchError) return res.status(500).json({ error: fetchError.message });

  if (existing && existing.length > 0) {
    // Update ALL existing preview logs for this file
    let updatedAny = false;
    for (const log of existing) {
      let viewedArr = Array.isArray(log.viewed_by_users) ? log.viewed_by_users : [];
      if (!viewedArr.some((entry: any) => entry.username === previewed_by)) {
        viewedArr.push({ username: previewed_by, previewed_at });
        const { error: updateError } = await supabase
          .from('file_upload_audit')
          .update({ viewed_by_users: viewedArr, previewed_by, previewed_at, action: 'preview' })
          .eq('id', log.id);
        if (updateError) return res.status(500).json({ error: updateError.message });
        updatedAny = true;
      }
    }
    if (updatedAny) return res.status(200).json({ updated: true });
    return res.status(200).json({ already_previewed: true });
  } else {
    // Insert new preview log ONLY if no row exists
    const { error } = await supabase.from('file_upload_audit').insert([
      { project_id, folder, file_name, previewed_by, previewed_at, action: 'preview', viewed_by_users: [{ username: previewed_by, previewed_at }] }
    ]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
}
