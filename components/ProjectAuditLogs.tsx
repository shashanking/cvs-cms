import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useProject } from './ProjectContext';

interface AuditLogBase {
  id: string;
  action: string;
  performed_by: string;
  details: {
    title?: string;
    description?: string;
    assignee?: string;
    status?: string;
    deadline?: string;
    comment?: string;
    event_topic?: string;
    timestamp: string;
    [key: string]: any;
  };
  created_at: string;
  logType: 'task' | 'event';
  project_id?: string;
  event_topic?: string;
}

interface TaskAuditLog extends AuditLogBase {
  task_id: string;
  logType: 'task';
}

interface EventAuditLog extends AuditLogBase {
  event_id: number;
  project_id: string;
  event_topic: string;
  logType: 'event';
}

type AuditLog = TaskAuditLog | EventAuditLog;

export function ProjectAuditLogs() {
  const { project } = useProject();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    fetchAuditLogs();
  }, [project?.id]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch task audit logs for this project
      const { data: taskLogs, error: taskError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Fetch event logs for this project
      const { data: eventLogs, error: eventError } = await supabase
        .from('event_logs')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      
      if (taskError) console.error('Error fetching task logs:', taskError);
      if (eventError) console.error('Error fetching event logs:', eventError);
      
      // Combine and sort all logs by created_at
      const allLogs = [
        ...(taskLogs || []).map(log => ({ 
          ...log, 
          logType: 'task' as const,
          details: typeof log.details === 'object' ? log.details : {}
        })),
        ...(eventLogs || []).map(log => ({
          ...log,
          logType: 'event' as const,
          details: {
            ...(typeof log.details === 'object' ? log.details : {}),
            event_topic: log.event_topic
          }
        }))
      ].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setLogs(allLogs as AuditLog[]);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    const actions: Record<string, string> = {
      // Task actions
      'task_created': 'Task Created',
      'task_updated': 'Task Updated',
      'task_deleted': 'Task Deleted',
      'task_time_logged': 'Time Logged',
      // Event actions
      'event_created': 'Event Created',
      'event_updated': 'Event Updated',
      'event_deleted': 'Event Deleted',
      'event_checked_in': 'Checked In',
      'event_comment': 'Commented',
      // Handle new action names
      'checked_in': 'Checked In',
      'commented': 'Commented',
      // Fallback
      'create': 'Created',
      'update': 'Updated',
      'delete': 'Deleted'
    };
    return actions[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      // Task icons
      'task_created': '📝',
      'task_updated': '✏️',
      'task_deleted': '🗑️',
      // Event icons
      'event_created': '📅',
      'event_updated': '✏️',
      'event_deleted': '🗑️',
      'event_checked_in': '✅',
      'event_comment': '💬',
      // Handle new action names
      'checked_in': '✅',
      'commented': '💬',
      // Task time log icon
      'task_time_logged': '⏱️',
      // Fallback icons
      'create': '➕',
      'update': '✏️',
      'delete': '🗑️',
      'comment': '💬',
      'check_in': '✅'
    };
    return icons[action] || '📋';
  };

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('delete')) return 'bg-red-100 text-red-800';
    if (actionLower.includes('create')) return 'bg-green-100 text-green-800';
    if (actionLower.includes('update')) return 'bg-blue-100 text-blue-800';
    if (actionLower.includes('check') || actionLower.includes('in')) return 'bg-purple-100 text-purple-800';
    if (actionLower.includes('comment')) return 'bg-indigo-100 text-indigo-800';
    return 'bg-gray-100 text-gray-800';
  };

  const [search, setSearch] = useState('');
  const filteredLogs = logs.filter(log =>
    log.performed_by?.toLowerCase().includes(search.toLowerCase()) ||
    (log.details?.title || log.details?.event_topic || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-4">Loading audit logs...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="overflow-x-auto mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
        <h2 className="text-xl font-semibold">Project Audit Logs</h2>
        <input
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="Search by user or title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />
      </div>
      <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow-md">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Action</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Title</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Type</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">By</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Time</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {filteredLogs.map((log, i) => (
            <tr key={log.id} className={i % 2 === 0 ? 'bg-gray-50 hover:bg-blue-50 transition' : 'bg-white hover:bg-blue-50 transition'}>
              <td className="px-4 py-2 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>{getActionIcon(log.action)} {getActionLabel(log.action)}</span>
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <span className="font-medium">{log.details.title || log.details.event_topic}</span>
              </td>
              <td className="px-4 py-2 whitespace-nowrap capitalize">{log.logType}</td>
              <td className="px-4 py-2 whitespace-nowrap">{log.performed_by}</td>
              <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                <time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time>
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                {log.action === 'task_time_logged' && (
                  <span className="text-yellow-700">Logged {log.details?.minutes || log.details?.time_spent_minutes || 0} min{log.details?.description && `: ${log.details.description}`}</span>
                )}
                {log.details.comment && (
                  <span className="text-gray-700">{log.details.comment}</span>
                )}
                {log.action !== 'task_time_logged' && !log.details.comment && (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProjectAuditLogs;
