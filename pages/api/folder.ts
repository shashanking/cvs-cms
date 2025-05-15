import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

// POST: Create folder
// DELETE: Delete folder
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'Missing project_id' });
    const { data, error } = await supabase.from('project_folders').select('name').eq('project_id', project_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ folders: data });
  }
  if (req.method === 'POST') {
    const { project_id, name, user } = req.body;
    if (!project_id || !name) return res.status(400).json({ error: 'Missing required fields' });
    // Insert into project_folders table
    const { data, error } = await supabase.from('project_folders').insert([{ project_id, name }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    // Create a .keep file in storage
    await supabase.storage.from('media').upload(`projects/${project_id}/${name}/.keep`, new Blob([''], { type: 'text/plain' }), { upsert: true });
    // Audit log
    await supabase.from('file_upload_audit').insert([
      {
        project_id,
        folder: name,
        file_name: null,
        uploaded_by: user || 'system',
        uploaded_at: new Date().toISOString(),
        action: 'folder_created'
      }
    ]);
    return res.status(200).json({ folder: data });
  }
  if (req.method === 'DELETE') {
    const { project_id, name, user } = req.body;
    if (!project_id || !name) return res.status(400).json({ error: 'Missing required fields' });
    // Remove from project_folders table
    const { error } = await supabase.from('project_folders').delete().eq('project_id', project_id).eq('name', name);
    if (error) return res.status(500).json({ error: error.message });
    // Remove all files in the folder from storage
    const { data: files } = await supabase.storage.from('media').list(`projects/${project_id}/${name}/`);
    if (files && files.length > 0) {
      const paths = files.map((f: any) => `projects/${project_id}/${name}/${f.name}`);
      await supabase.storage.from('media').remove(paths);
    }
    // Audit log
    await supabase.from('file_upload_audit').insert([
      {
        project_id,
        folder: name,
        file_name: null,
        uploaded_by: user || 'system',
        uploaded_at: new Date().toISOString(),
        action: 'folder_deleted'
      }
    ]);
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
