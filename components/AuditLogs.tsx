import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface AuditLogsProps {
  projectId: string;
  folder: string;
}

export default function AuditLogs({ projectId, folder }: AuditLogsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Search/filter state
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (!projectId || !folder) return;
    setLoading(true);
    // Initial fetch
    supabase
      .from('file_upload_audit')
      .select('*')
      .eq('project_id', projectId)
      .eq('folder', folder)
      .order('uploaded_at', { ascending: false })
      .then(({ data }) => {
        setLogs(data || []);
        setLoading(false);
      });

    // Subscribe to realtime INSERT events
    const channel = supabase.channel('file_upload_audit_insert')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'file_upload_audit',
        },
        (payload) => {
          const newLog = payload.new;
          // Project-wide logs (e.g. project_created) have folder null; others match by folder
          if (newLog.project_id === projectId && (newLog.folder === folder || newLog.folder === null)) {
            setLogs((prev) => {
              const updated = [newLog, ...prev];
              // Sort by timestamp descending
              return updated.sort((a, b) => {
                const ta = a.uploaded_at || a.deleted_at || a.previewed_at || a.downloaded_at || a.created_at || '';
                const tb = b.uploaded_at || b.deleted_at || b.previewed_at || b.downloaded_at || b.created_at || '';
                return (new Date(tb).getTime() || 0) - (new Date(ta).getTime() || 0);
              });
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId, folder]);

  return (
    <div style={{ marginTop: 24 }}>
      <h4>Audit Log</h4>
      {loading ? (
        <span>Loading audit log...</span>
      ) : logs.length === 0 ? (
        <span>No audit records yet.</span>
      ) : (
        <div>
          {/* Search/Filter UI */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ padding: 6, minWidth: 110 }}>
              <option value=''>All Actions</option>
              <option value='upload'>Upload</option>
              <option value='file_deleted'>File Deleted</option>
              <option value='link_deleted'>Link Deleted</option>
              <option value='folder_created'>Folder Created</option>
              <option value='folder_deleted'>Folder Deleted</option>
              <option value='preview'>Preview</option>
              <option value='download'>Download</option>
              <option value='project_created'>Project Created</option>
            </select>
            <input value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder='User' style={{ padding: 6, minWidth: 110 }} />
            <input value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder='File/Folder/Link' style={{ padding: 6, minWidth: 140 }} />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: 6, minWidth: 110 }}>
              <option value=''>All Types</option>
              <option value='google_doc'>Google Doc</option>
              <option value='google_sheet'>Google Sheet</option>
            </select>
            <input type='date' value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: 6 }} />
            <span style={{ alignSelf: 'center' }}>to</span>
            <input type='date' value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: 6 }} />
          </div>
          <div style={{ overflowX: 'auto', marginTop: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Action</th>
                  <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>URL</th>
                  <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>By</th>
                  <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Time</th>
                  <th style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'left' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs
                  .filter(log => {
                    // Action filter
                    if (actionFilter && (log.action || 'upload') !== actionFilter) return false;
                    // User filter
                    const by = log.uploaded_by || log.deleted_by || log.previewed_by || log.downloaded_by || '';
                    if (userFilter && !by.toLowerCase().includes(userFilter.toLowerCase())) return false;
                    // Name filter
                    const name = log.file_name || log.folder || log.project_name || log.project_id || '';
                    if (nameFilter && !name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
                    // Type filter
                    let type = log.type || (log.is_google_link ? (log.type || (log.url?.includes('sheet') ? 'google_sheet' : 'google_doc')) : '');
                    if (typeFilter && type !== typeFilter) return false;
                    // Date range filter
                    let time = log.uploaded_at || log.deleted_at || log.previewed_at || log.downloaded_at || log.created_at || '';
                    if (fromDate && (!time || new Date(time) < new Date(fromDate))) return false;
                    if (toDate && (!time || new Date(time) > new Date(toDate + 'T23:59:59'))) return false;
                    return true;
                  })
                  .sort((a, b) => {
                    // Always sort by time descending
                    const ta = a.uploaded_at || a.deleted_at || a.previewed_at || a.downloaded_at || a.created_at || '';
                    const tb = b.uploaded_at || b.deleted_at || b.previewed_at || b.downloaded_at || b.created_at || '';
                    return (new Date(tb).getTime() || 0) - (new Date(ta).getTime() || 0);
                  })
                  .map((log, i) => {
                    // Determine display values
                    let action = log.action || 'upload';
                    let name = log.file_name || log.folder || log.project_name || log.project_id || '-';
                    let type = log.type || (log.is_google_link ? (log.type || (log.url?.includes('sheet') ? 'google_sheet' : 'google_doc')) : '');
                    let url = log.url || '';
                    let by = log.uploaded_by || log.deleted_by || log.previewed_by || log.downloaded_by || '-';
                    let time = log.uploaded_at || log.deleted_at || log.previewed_at || log.downloaded_at || log.created_at || '';
                    let details = '';
                    // Details for previews/downloads with multiple users
                    if (action === 'preview' && Array.isArray(log.viewed_by_users) && log.viewed_by_users.length > 0) {
                      details = log.viewed_by_users.map((v: any) => `${v.username} at ${v.previewed_at ? new Date(v.previewed_at).toLocaleString() : 'Unknown'}`).join('; ');
                    } else if (action === 'download' && Array.isArray(log.downloaded_by_users) && log.downloaded_by_users.length > 0) {
                      details = log.downloaded_by_users.map((d: any) => `${d.username} at ${d.downloaded_at ? new Date(d.downloaded_at).toLocaleString() : 'Unknown'}`).join('; ');
                    }
                    // Color for Google types
                    let typeColor = type === 'google_sheet' ? '#34a853' : type === 'google_doc' ? '#4285F4' : '#888';
                    let typeLabel = type === 'google_sheet' ? 'Sheet' : type === 'google_doc' ? 'Doc' : (type || '-');
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f1f1' }}>
                        <td style={{ padding: 8 }}>{action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                        <td style={{ padding: 8 }}>{name}</td>
                        <td style={{ padding: 8 }}>
                          {typeLabel && (<span style={{ color: typeColor, fontWeight: 600 }}>{typeLabel}</span>)}
                          {log.is_google_link ? <span style={{ marginLeft: 6, color: '#888', fontSize: 12 }}>(Google Link)</span> : null}
                        </td>
                        <td style={{ padding: 8 }}>
                          {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>Open</a> : '-'}
                        </td>
                        <td style={{ padding: 8 }}>{by}</td>
                        <td style={{ padding: 8 }}>{time ? new Date(time).toLocaleString() : '-'}</td>
                        <td style={{ padding: 8 }}>{details}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
