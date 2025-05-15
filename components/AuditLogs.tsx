import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface AuditLogsProps {
  projectId: string;
  folder: string;
}

export default function AuditLogs({ projectId, folder }: AuditLogsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
            setLogs((prev) => [newLog, ...prev]);
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
        <ul style={{ fontSize: 14 }}>
          {logs.map((log, i) => (
            <li key={i}>
              {log.action === 'project_created' && (
                <>Project <b>{log.project_name || log.project_id}</b> created by <b>{log.uploaded_by}</b> at <b>{new Date(log.uploaded_at).toLocaleString()}</b></>
              )}
              {log.action === 'folder_created' && (
                <>Folder <b>{log.folder}</b> created by <b>{log.uploaded_by}</b> at <b>{new Date(log.uploaded_at).toLocaleString()}</b></>
              )}
              {log.action === 'folder_deleted' && (
                <>Folder <b>{log.folder}</b> deleted by <b>{log.uploaded_by}</b> at <b>{new Date(log.uploaded_at).toLocaleString()}</b></>
              )}
              {log.action === 'preview' && Array.isArray(log.viewed_by_users) && log.viewed_by_users.length > 0 ? (
                log.viewed_by_users.map((v: any, idx: number) => (
                  <div key={idx}>
                    Previewed <b>{log.file_name}</b> by <b>{v.username}</b> at <b>{v.previewed_at ? new Date(v.previewed_at).toLocaleString() : 'Unknown'}</b>
                  </div>
                ))
              ) : log.action === 'preview' && (
                <>Previewed <b>{log.file_name}</b> by <b>{log.previewed_by}</b> at <b>{log.previewed_at ? new Date(log.previewed_at).toLocaleString() : 'Unknown'}</b></>
              )}
              {log.action === 'download' && Array.isArray(log.downloaded_by_users) && log.downloaded_by_users.length > 0 ? (
                log.downloaded_by_users.map((d: any, idx: number) => (
                  <div key={idx}>
                    Downloaded <b>{log.file_name}</b> by <b>{d.username}</b> at <b>{d.downloaded_at ? new Date(d.downloaded_at).toLocaleString() : 'Unknown'}</b>
                  </div>
                ))
              ) : log.action === 'download' && (
                <>Downloaded <b>{log.file_name}</b> by <b>{log.downloaded_by}</b> at <b>{log.downloaded_at ? new Date(log.downloaded_at).toLocaleString() : 'Unknown'}</b></>
              )}
              {(!log.action || log.action === 'upload') && log.uploaded_by && log.uploaded_at && (
                <>Uploaded <b>{log.file_name}</b> by <b>{log.uploaded_by}</b> at <b>{new Date(log.uploaded_at).toLocaleString()}</b></>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
