import { useState, useEffect } from 'react';
import { useProject } from './ProjectContext';
import { supabase } from '../lib/supabaseClient';

// Define a base interface for audit logs (tasks or events)
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
    [key: string]: any; // allow extra fields in details
  };
  created_at: string;
  logType: 'task' | 'event'; // discriminates between task and event
  project_id?: string;
  event_topic?: string;
}

// Task audit log interface extending base, with task-specific fields
interface TaskAuditLog extends AuditLogBase {
  task_id: string;
  logType: 'task';
}

// Event audit log interface extending base, with event-specific fields
interface EventAuditLog extends AuditLogBase {
  event_id: number;
  project_id: string;
  event_topic: string;
  logType: 'event';
}

// Union type representing an audit log record
type AuditLog = TaskAuditLog | EventAuditLog;

export function ProjectAuditLogs() {
  // Get the current project from context
  const { project } = useProject();

  // React state: the combined audit logs
  const [logs, setLogs] = useState<AuditLog[]>([]);
  // Loading state flag
  const [loading, setLoading] = useState(true);
  // Error state for API or fetch issues
  const [error, setError] = useState<string | null>(null);

  // useEffect to fetch logs whenever project ID changes
  useEffect(() => {
    if (!project?.id) return; // Exit early if no project selected

    // Invoke fetching
    fetchAuditLogs();
  }, [project?.id]);

  // Async function to fetch logs for both task and event audit tables
  const fetchAuditLogs = async () => {
    try {
      setLoading(true);  // Indicate loading state
      setError(null);    // Clear previous errors

      // Fetch task audit logs, ordering by creation time descending
      const { data: taskLogs, error: taskError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch event audit logs for current project, ordered by creation time descending
      const { data: eventLogs, error: eventError } = await supabase
        .from('event_logs')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      // Log errors if any from Supabase
      if (taskError) console.error('Error fetching task logs:', taskError);
      if (eventError) console.error('Error fetching event logs:', eventError);

      // Combine logs from task and event sources into one array,
      // adding a discriminating 'logType' and normalize details
      const allLogs = [
        ...(taskLogs || []).map(log => ({
          ...log,
          logType: 'task' as const,
          // Ensure details is an object even if stored as string
          details: typeof log.details === 'object' ? log.details : {}
        })),
        ...(eventLogs || []).map(log => ({
          ...log,
          logType: 'event' as const,
          // Spread existing details, add event_topic from event log for convenience
          details: {
            ...(typeof log.details === 'object' ? log.details : {}),
            event_topic: log.event_topic
          }
        }))
      ]
        // Sort combined logs by created_at descending (newest first)
        .sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      // Update state with combined logs
      setLogs(allLogs as AuditLog[]);
    } catch (error) {
      // Catch and log unexpected errors, set error message state
      console.error('Error fetching audit logs:', error);
      setError('Failed to load audit logs');
    } finally {
      // Always clear loading flag
      setLoading(false);
    }
  };

  // Map action strings to human-readable labels for display
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
      // Alternate naming for new action names
      'checked_in': 'Checked In',
      'commented': 'Commented',
      // Generic fallback labels
      'create': 'Created',
      'update': 'Updated',
      'delete': 'Deleted'
    };
    // Return matching label or prettify unknown action strings
    return actions[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Map action strings to emojis/icons for UI
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
      // New action icons mapping
      'checked_in': '✅',
      'commented': '💬',
      // Task time log icon
      'task_time_logged': '⏱️',
      // Generic fallback icons
      'create': '➕',
      'update': '✏️',
      'delete': '🗑️',
      'comment': '💬',
      'check_in': '✅'
    };
    // Return matching icon or default clipboard icon
    return icons[action] || '📋';
  };

  // Map actions to Tailwind-like bg/text color classes for badges (not applied in JSX here)
  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('delete')) return 'bg-red-100 text-red-800';
    if (actionLower.includes('create')) return 'bg-green-100 text-green-800';
    if (actionLower.includes('update')) return 'bg-blue-100 text-blue-800';
    if (actionLower.includes('check') || actionLower.includes('in')) return 'bg-purple-100 text-purple-800';
    if (actionLower.includes('comment')) return 'bg-indigo-100 text-indigo-800';
    return 'bg-gray-100 text-gray-800';
  };

  // State for search input to filter logs by user or title/topic
  const [search, setSearch] = useState('');

  // Filter the logs based on search input on performed_by or title/event_topic fields
  const filteredLogs = logs.filter(log =>
    log.performed_by?.toLowerCase().includes(search.toLowerCase()) ||
    (log.details?.title || log.details?.event_topic || '').toLowerCase().includes(search.toLowerCase())
  );

  // Show loading message while fetching logs
  if (loading) return <div className="p-4">Loading audit logs...</div>;

  // Show error message if fetch failed
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  // Main UI of audit log table and search box
  return (
    <div className="overflow-x-auto mt-6">
      {/* Header with title and search box */}
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

      {/* Table displaying filtered audit logs */}
      <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow-md">
        <thead className="bg-gray-50 sticky top-0 z-10">
          {/* Table headers */}
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
          {/* Iterate through filtered logs */}
          {filteredLogs.map((log, i) => (
            <tr
              key={log.id}
              className={i % 2 === 0 ? 'bg-gray-50 hover:bg-blue-50 transition' : 'bg-white hover:bg-blue-50 transition'}
            >
              {/* Action column: show icon + label with colored badge styling */}
              <td className="px-4 py-2 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                  {getActionIcon(log.action)} {getActionLabel(log.action)}
                </span>
              </td>

              {/* Title column: show title or event_topic */}
              <td className="px-4 py-2 whitespace-nowrap">
                <span className="font-medium">{log.details.title || log.details.event_topic}</span>
              </td>

              {/* Type column */}
              <td className="px-4 py-2 whitespace-nowrap capitalize">{log.logType}</td>

              {/* Performed by user */}
              <td className="px-4 py-2 whitespace-nowrap">{log.performed_by}</td>

              {/* Time column formatted as local datetime */}
              <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                <time dateTime={log.created_at}>
                  {new Date(log.created_at).toLocaleString()}
                </time>
              </td>

              {/* Details column: conditionally render details like time logged or comments */}
              <td className="px-4 py-2 whitespace-nowrap">
                {/* Show time logged with description */}
                {log.action === 'task_time_logged' && (
                  <span className="text-yellow-700">
                    Logged {log.details?.minutes || log.details?.time_spent_minutes || 0} min
                    {log.details?.description && `: ${log.details.description}`}
                  </span>
                )}
                {/* Show comments if available */}
                {log.details.comment && (
                  <span className="text-gray-700">{log.details.comment}</span>
                )}
                {/* Show dash when no time logged or comments */}
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
