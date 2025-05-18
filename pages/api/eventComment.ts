import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

// Add a comment or check-in to an event
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { event_id, username, comment, check_in } = req.body;
    if (!event_id || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Prevent duplicate check-ins
    if (check_in) {
      const { data: existingCheckIn, error: checkInError } = await supabase
        .from('event_comments')
        .select('id')
        .eq('event_id', event_id)
        .eq('username', username)
        .eq('check_in', true)
        .maybeSingle();
      if (existingCheckIn) {
        return res.status(400).json({ error: 'You have already checked in to this event.' });
      }
      if (checkInError) {
        return res.status(500).json({ error: checkInError.message });
      }
    }

    // Ensure check_in is a boolean - handle both boolean and string values
    const isCheckIn = check_in === true || check_in === 'true';
    console.log('[DEBUG] eventComment input:', { event_id, username, comment, check_in, isCheckIn, type: typeof check_in });
    
    // For check-ins, store empty comment
    const { data, error } = await supabase.from('event_comments').insert([
      { event_id, username, comment: isCheckIn ? '' : comment, check_in: isCheckIn }
    ]);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    // Log to event_logs for Activity tab
    if (data && data[0]) {
      const projectIdResult = await supabase
        .from('project_events')
        .select('project_id')
        .eq('id', event_id)
        .single();
      const project_id = projectIdResult.data?.project_id;
      if (project_id) {
        // IMPORTANT: For check-ins, action must be 'checked_in', not 'commented'
        // Force the action to be exactly 'checked_in' for check-ins
        const action = isCheckIn ? 'checked_in' : 'commented';
        console.log('[DEBUG] Setting action to:', action, 'for isCheckIn:', isCheckIn);
        
        const details = {
          comment: isCheckIn ? '' : comment,
          check_in: isCheckIn,
          event_topic: null // Will be populated from project_events
        };
        
        // Get event topic for better display in logs
        const { data: eventData } = await supabase
          .from('project_events')
          .select('topic')
          .eq('id', event_id)
          .single();
          
        if (eventData?.topic) {
          details.event_topic = eventData.topic;
        }
        
        const logPayload = {
          event_id,
          project_id,
          action, // This will be 'checked_in' for check-ins
          performed_by: username,
          details,
          created_at: new Date().toISOString()
        };
        
        console.log('[DEBUG] event_logs insert FINAL:', logPayload);
        const { error: logError } = await supabase.from('event_logs').insert([logPayload]);
        
        if (logError) {
          console.error('[ERROR] Failed to log event action:', logError);
        }
      }
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
