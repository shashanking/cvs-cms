import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const FOLDERS = ['finance', 'tech', 'invoices', 'proposals', 'reports', 'media', 'others',];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, description, created_by } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  // Track who and when
  const createdAt = new Date().toISOString();
  const id = uuidv4();
  const { data: project, error } = await supabase
    .from('projects')
    .insert([{ id, name, description, created_by: created_by || 'unknown', created_at: createdAt }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Create folders in Supabase Storage
  const basePath = `projects/${project.id}/`;
  for (const folder of FOLDERS) {
    // Supabase Storage doesn't have true folders, so we upload a ".keep" file in each folder
    await supabase.storage.from('media').upload(`${basePath}${folder}/.keep`, new Blob([''], { type: 'text/plain' }), {
      upsert: true,
    });
  }

  // Log project creation in audit table
  await supabase.from('file_upload_audit').insert([
    {
      project_id: project.id,
      folder: null,
      file_name: null,
      uploaded_by: created_by || 'unknown',
      uploaded_at: createdAt,
      action: 'project_created',
      project_name: name
    }
  ]);

  return res.status(200).json({ project });
}
