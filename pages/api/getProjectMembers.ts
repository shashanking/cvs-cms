import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

// Returns all usernames for a given project_id
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'Missing project_id' });

  // Try to fetch from a project_members table (recommended), fallback to created_by if not present
  let usernames: string[] = [];
  // Try to fetch from project_members table
  let { data: members, error } = await supabase
    .from('project_members')
    .select('username')
    .eq('project_id', project_id);
  if (!error && members && members.length > 0) {
    usernames = members.map((m: any) => m.username);
  } else {
    // Fallback: fetch project creator
    const { data: project } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', project_id)
      .single();
    if (project && project.created_by) usernames = [project.created_by];
  }
  return res.status(200).json({ usernames });
}
