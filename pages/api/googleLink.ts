import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

// POST: Add a Google Doc/Sheet link
// GET: List all Google links for a folder
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { project_id, folder, name, url, type, uploaded_by, uploaded_at } = req.body;
    if (!project_id || !folder || !name || !url || !type || !uploaded_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { error, data } = await supabase.from('project_links').insert([
      { project_id, folder, name, url, type, uploaded_by, uploaded_at }
    ]) as { error: any, data: any[] | null };
    if (error) return res.status(500).json({ error: error.message });
    // Defensive: If data is null, return a fallback object
    const link = data && Array.isArray(data) && data.length > 0 ? data[0] : { project_id, folder, name, url, type, uploaded_by, uploaded_at };
    return res.status(201).json({ success: true, link });
  }
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const { error } = await supabase.from('project_links').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  if (req.method === 'GET') {
    const { project_id, folder } = req.query;
    if (!project_id || !folder) return res.status(400).json({ error: 'Missing project_id or folder' });
    const { data, error } = await supabase
      .from('project_links')
      .select('*')
      .eq('project_id', project_id)
      .eq('folder', folder)
      .order('uploaded_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ links: data });
  }
  res.setHeader('Allow', ['POST', 'GET']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
