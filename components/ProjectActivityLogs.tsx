import { useState, useEffect } from 'react';
import { useProject } from './ProjectContext';
import { supabase } from '../lib/supabaseClient';

type ActivityLog = {
  id: string;
  type: 'event' | 'task';
  action: string;
  performed_by: string;
  created_at: string;
  details: any;
  reference_id: string | number;
  title?: string;
};

export function ProjectActivityLogs() {
  const { project } = useProject();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    
    const fetchActivityLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/project/logs?projectId=${project.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch activity logs');
        }
        
        const data = await response.json();
        setLogs(data.logs || []);
      } catch (err) {
        console.error('Error fetching activity logs:', err);
        setError('Failed to load activity logs');
      } finally {
        setLoading(false);
      }
    };

    fetchActivityLogs();

    // Real-time updates for event_logs and task_logs
    const eventLogSub = supabase
      .channel('event-logs-activity')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_logs', filter: `project_id=eq.${project.id}` },
        () => fetchActivityLogs()
      )
      .subscribe();

    const taskLogSub = supabase
      .channel('task-logs-activity')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_logs', filter: `project_id=eq.${project.id}` },
        () => fetchActivityLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventLogSub);
      supabase.removeChannel(taskLogSub);
    };
  }, [project?.id]);

  const getActionLabel = (action: string) => {
    const actions: Record<string, string> = {
      // Event actions
      'created': 'created',
      'updated': 'updated',
      'deleted': 'deleted',
      'comment': 'commented on',
      'checked_in': 'checked in to',
      'check_in': 'checked in to',
      // Task actions
      'time_log': 'logged time on',
      // Fallback
      'unknown': 'performed an action on'
    };
    return actions[action] || actions['unknown'];
  };

  const getActionIcon = (action: string, type: 'event' | 'task') => {
    // Icons for different action types
    const icons: Record<string, string> = {
      // Event icons
      'created': '📅',
      'updated': '✏️',
      'deleted': '🗑️',
      'comment': '💬',
      'checked_in': '✅',
      'check_in': '✅',
      // Task icons
      'time_log': '⏱️',
      // Fallback
      'default': type === 'event' ? '📅' : '📝'
    };

    return icons[action] || icons['default'];
  };

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('delete')) return 'bg-red-100 text-red-800';
    if (actionLower.includes('create')) return 'bg-green-100 text-green-800';
    if (actionLower.includes('update')) return 'bg-blue-100 text-blue-800';
    if (actionLower.includes('check') || actionLower.includes('in')) return 'bg-purple-100 text-purple-800';
    if (actionLower.includes('comment')) return 'bg-indigo-100 text-indigo-800';
    if (actionLower.includes('time')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredLogs = logs.filter(log => {
    // Action filter
    if (actionFilter && log.action !== actionFilter) return false;
    // User filter
    if (userFilter && !log.performed_by?.toLowerCase().includes(userFilter.toLowerCase())) return false;
    // Title filter
    if (titleFilter && !(log.title || '').toLowerCase().includes(titleFilter.toLowerCase())) return false;
    // Type filter
    if (typeFilter && log.type !== typeFilter) return false;
    // Date range filter
    if (fromDate && new Date(log.created_at) < new Date(fromDate)) return false;
    if (toDate && new Date(log.created_at) > new Date(toDate + 'T23:59:59')) return false;
    // General search (optional: keep for fuzzy search)
    if (search && !(
      log.performed_by?.toLowerCase().includes(search.toLowerCase()) ||
      (log.title || '').toLowerCase().includes(search.toLowerCase())
    )) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-md"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-center">
        No activity logs found for this project.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto mt-6">
      {/* Filter/Search Row */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{ minWidth: 120, padding: 8, borderRadius: 6, border: '1px solid #cbd5e0', marginRight: 10 }}
        >
          <option value="">All Actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
          <option value="comment">Commented</option>
          <option value="checked_in">Checked In</option>
          <option value="time_log">Time Log</option>
        </select>
        <input
          className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[110px]"
          placeholder="User"
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
        />
        <input
          className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[140px]"
          placeholder="Title"
          value={titleFilter}
          onChange={e => setTitleFilter(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[110px]"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value=''>All Types</option>
          <option value='task'>Task</option>
          <option value='event'>Event</option>
        </select>
        <input
          type="date"
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
        />
        <span className="text-gray-400 text-xs">to</span>
        <input
          type="date"
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
        />
      </div>
      <div style={{ overflowX: 'auto', marginTop: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Action</th>
              <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Title</th>
              <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Type</th>
              <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>By</th>
              <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Time</th>
              <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 12, textAlign: 'center', color: '#888' }}>
                  No activity logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f1f1' }} onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.background = ''}>
                  <td style={{ padding: 8 }}>
                    {log.action === 'checked_in' || log.action === 'check_in' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 12, fontSize: 13, fontWeight: 500, color: '#7e22ce', background: '#f3e8ff' }}>
                        ✅ checked in to
                      </span>
                    ) : log.action === 'comment' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 12, fontSize: 13, fontWeight: 500, color: '#4f46e5', background: '#e0e7ff' }}>
                        💬 commented on
                      </span>
                    ) : log.action === 'time_log' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 12, fontSize: 13, fontWeight: 500, color: '#ca8a04', background: '#fef9c3' }}>
                        ⏱️ logged time on
                      </span>
                    ) : log.action === 'created' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 12, fontSize: 13, fontWeight: 500, color: '#16a34a', background: '#dcfce7' }}>
                        📝 created
                      </span>
                    ) : log.action === 'updated' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 12, fontSize: 13, fontWeight: 500, color: '#2563eb', background: '#dbeafe' }}>
                        ✏️ updated
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 12, fontSize: 13, fontWeight: 500, color: '#6b7280', background: '#f3f4f6' }}>
                        {getActionIcon(log.action, log.type)} {getActionLabel(log.action)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <a href={`#${log.type}-${log.reference_id}`} style={{ fontWeight: 500, color: '#2563eb', textDecoration: 'none' }} onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}>
                      {log.title}
                    </a>
                  </td>
                  <td style={{ padding: 8, textTransform: 'capitalize' }}>{log.type}</td>
                  <td style={{ padding: 8 }}>{log.performed_by}</td>
                  <td style={{ padding: 8, color: '#6b7280' }}>{formatDate(log.created_at)}</td>
                  <td style={{ padding: 8 }}>
                    {log.action === 'time_log' && (
                      <span style={{ color: '#ca8a04' }}>Logged {log.details?.minutes} min{log.details?.description && `: ${log.details.description}`}</span>
                    )}
                    {log.action === 'comment' && log.details?.comment && (
                      <span style={{ color: '#4b5563' }}>{log.details.comment}</span>
                    )}
                    {log.action !== 'time_log' && log.action !== 'comment' && (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
