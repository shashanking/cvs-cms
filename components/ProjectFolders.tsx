import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import AuditLogs from './AuditLogs';
import SheetPreview from './SheetPreview';
import DocPreview from './DocPreview';
import Notifications from './Notifications';

import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

interface ProjectFoldersProps {
  folders: string[];
}

function isValidUUID(uuid: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

interface ProjectFoldersPropsWithCallback extends ProjectFoldersProps {
  onFileAction?: () => void;
}

export default function ProjectFolders({ folders, onFileAction }: ProjectFoldersPropsWithCallback) {
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [previewLogs, setPreviewLogs] = useState<Record<string, { entries: { username: string, time: string }[] }>>({}); // fileName: { entries: [{username, time}] }
  const [downloadLogs, setDownloadLogs] = useState<Record<string, { usernames: string[]; uploaded_by: string }>>({}); // fileName: { usernames, uploaded_by }
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditRefresh, setAuditRefresh] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'sheet' | 'doc' | null>(null);
  const [dbFolders, setDbFolders] = useState<string[]>([]); // Only folders from DB
  const [newFolder, setNewFolder] = useState<string>('');
  const [folderLoading, setFolderLoading] = useState<string | null>(null);

  // Fetch folders from DB on mount or projectId change
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const res = await fetch('/api/folder?project_id=' + projectId);
      const data = await res.json();
      if (res.ok && Array.isArray(data.folders)) {
        setDbFolders(data.folders.map((f: any) => f.name));
      } else {
        setDbFolders([]);
      }
    })();
  }, [projectId]);

  // Real-time updates for preview/download logs
  useEffect(() => {
    if (!projectId || !selectedFolder) return;
    // Subscribe to preview log updates
    const previewChannel = supabase.channel('file_upload_audit_preview_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'file_upload_audit',
        filter: `action=eq.preview`
      }, (payload: { new?: any }) => {
        if (payload.new?.project_id === projectId && payload.new?.folder === selectedFolder) {
          loadFiles(selectedFolder);
        }
      })
      .subscribe();
    // Subscribe to download log updates
    const downloadChannel = supabase.channel('file_upload_audit_download_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'file_upload_audit',
        filter: `action=eq.download`
      }, (payload: { new?: any }) => {
        if (payload.new?.project_id === projectId && payload.new?.folder === selectedFolder) {
          loadFiles(selectedFolder);
        }
      })
      .subscribe();
    return () => {
      previewChannel.unsubscribe();
      downloadChannel.unsubscribe();
    };
  }, [projectId, selectedFolder]);

  // Load files in folder
  const loadFiles = async (folder: string) => {
  setSelectedFolder(folder);
  setError(null);
  // Fetch regular files
  const { data: fileData, error } = await supabase.storage.from('media').list(`projects/${projectId}/${folder}/`, { limit: 100 });
  if (error) setError(error.message);
  // Fetch Google links from backend
  const res = await fetch(`/api/googleLink?project_id=${projectId}&folder=${encodeURIComponent(folder)}`);
  let googleLinks: any[] = [];
  if (res.ok) {
    const linkData = await res.json();
    googleLinks = (linkData.links || []).map((l: any) => ({
      name: l.name,
      url: l.url,
      type: l.type === 'doc' ? 'google_doc' : 'google_sheet',
      id: l.id,
      uploaded_by: l.uploaded_by,
      uploaded_at: l.uploaded_at,
    }));
  }
  // Merge files and links for display
  setFiles([...(fileData || []), ...googleLinks]);

  // Fetch preview logs for all files in this folder
  const { data: logs } = await supabase
    .from('file_upload_audit')
    .select('file_name, viewed_by_users')
    .eq('project_id', projectId)
    .eq('folder', folder)
    .eq('action', 'preview');
  const logMap: Record<string, { entries: { username: string, time: string }[] }> = {};
  if (logs) {
    logs.forEach((log: any) => {
      if (log.file_name && Array.isArray(log.viewed_by_users)) {
        const entries = log.viewed_by_users.map((entry: any) => ({ username: entry.username, time: entry.previewed_at || entry.time || '' }));
        logMap[log.file_name] = { entries };
      }
    });
  }
  setPreviewLogs(logMap);

  // Fetch download logs for all files in this folder
  const { data: downloadLogsData } = await supabase
    .from('file_upload_audit')
    .select('file_name, downloaded_by_users, uploaded_by')
    .eq('project_id', projectId)
    .eq('folder', folder)
    .eq('action', 'download');
  const downloadLogMap: Record<string, { usernames: string[]; uploaded_by: string }> = {};
  if (downloadLogsData) {
    downloadLogsData.forEach((log: any) => {
      if (log.file_name && Array.isArray(log.downloaded_by_users)) {
        const usernames = log.downloaded_by_users.map((entry: any) => entry.username);
        downloadLogMap[log.file_name] = {
          usernames,
          uploaded_by: log.uploaded_by || '',
        };
      }
    });
  }
  setDownloadLogs(downloadLogMap);
};

  // Refresh audit logs
  const loadAuditLogs = () => setAuditRefresh(x => x + 1);

  // Upload file and track
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFolder || !e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    setError(null);
    const file = e.target.files[0];
    const uniqueFileName = `${Date.now()}_${file.name}`;
    const path = `projects/${projectId}/${selectedFolder}/${uniqueFileName}`;
    const { error: uploadError } = await supabase.storage.from('media').upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    // Track upload in audit table using the unique file name
    await fetch('/api/auditFileUpload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        folder: selectedFolder,
        file_name: uniqueFileName,
        uploaded_by: user.username,
        uploaded_at: new Date().toISOString(),
      }),
    });
    setUploading(false);
    // Immediately update files list to include the new file with uniqueFileName
    setFiles(prev => ([...prev, { name: uniqueFileName, ...file }]));
    loadFiles(selectedFolder);
    loadAuditLogs();
  };

  if (!isValidUUID(projectId)) {
    return (
      <div style={{ color: 'red', margin: '20px 0' }}>
        <strong>Error:</strong> Invalid project ID. Please select a valid project.<br />
        (projectId: {String(projectId)})
      </div>
    );
  }

  return (
    <div style={{ margin: '4vw 0' }}>
      <Notifications />
      <div>
        {(!selectedFolder) ? (
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 18, color: '#2563eb', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.5rem' }}>🗂️</span> Folders
            </h3>
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <div style={{ display: 'flex', overflowX: 'auto', gap: 18, paddingBottom: 8 }}>
                {Array.from(new Set([...(folders || []), ...dbFolders])).map((folder) => (
                  <div key={folder} style={{ minWidth: 120, background: '#f1f5f9', borderRadius: 12, boxShadow: '0 2px 8px #e3f0ff', border: '1.5px solid #c3dafc', padding: '18px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', transition: 'box-shadow 0.2s', cursor: 'pointer' }}
                    onClick={() => loadFiles(folder)}
                    tabIndex={0}
                    onKeyPress={e => (e.key === 'Enter' ? loadFiles(folder) : undefined)}
                  >
                    <span style={{ fontSize: '2rem', color: '#2563eb', marginBottom: 6 }}>📁</span>
                    <span style={{ fontWeight: 600, color: '#222', fontSize: '1rem', marginBottom: 2 }}>{folder}</span>
                    <span style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{/* File count badge placeholder */}</span>
                    {!Array.from(new Set([...(folders || [])])).includes(folder) && (
                      <button
                        style={{ position: 'absolute', top: 8, right: 8, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: 0.7 }}
                        title="Delete folder"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Delete folder '${folder}' and all its files?`)) return;
                          setFolderLoading(folder);
                          const res = await fetch('/api/folder', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ project_id: projectId, name: folder, user: user.username })
                          });
                          if (res.ok) {
                            setDbFolders((prev) => prev.filter(f => f !== folder));
                          } else {
                            const data = await res.json();
                            setError(data.error || 'Could not delete folder');
                          }
                          setFolderLoading(null);
                        }}
                      >🗑️</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', right: 0, top: '-50px', display: 'flex', gap: 6 }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const folderName = newFolder.trim();
                    if (!folderName || dbFolders.includes(folderName)) return;
                    setFolderLoading(folderName);
                    const res = await fetch('/api/folder', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ project_id: projectId, name: folderName, user: user.username })
                    });
                    const data = await res.json();
                    if (res.ok && data.folder) {
                      setDbFolders((prev) => [...prev, data.folder.name]);
                      setNewFolder('');
                    } else {
                      setError(data.error || 'Could not add folder');
                    }
                    setFolderLoading(null);
                  }}
                >
                  <input
                    type="text"
                    value={newFolder}
                    onChange={e => setNewFolder(e.target.value)}
                    placeholder="New folder name"
                    style={{ padding: 8, borderRadius: 6, border: '1.5px solid #c3dafc', outline: 'none', fontSize: 15 }}
                    disabled={!!folderLoading}
                  />
                  <button type="submit" disabled={!newFolder.trim() || !!folderLoading} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
                    {folderLoading ? '...' : '+'}
                  </button>
                </form>
              </div>
            </div>
            {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          </div>
        ) : (
          <div>
            <button onClick={() => setSelectedFolder(null)} style={{ marginBottom: 18, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 500, color: '#2563eb', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseOver={e => (e.currentTarget.style.background = '#e2e8f0')}
              onMouseOut={e => (e.currentTarget.style.background = '#f1f5f9')}
            >← Back to Folders</button>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#2563eb', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.3rem' }}>📁</span> {selectedFolder}
            </h3>
            <div className="file-actions-row">
              <input type="file" onChange={handleUpload} disabled={uploading} style={{ fontSize: 15, height: 40, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 10px', background: '#fff' }} />
              <button
                style={{ background: '#34a853', color: '#fff', border: 'none', borderRadius: 6, padding: '0 18px', height: 40, fontWeight: 600, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                onClick={async () => {
  const url = window.prompt('Paste Google Doc or Sheet link:');
  if (!url) return;
  const name = window.prompt('Display name (optional):') || 'Google Doc/Sheet';
  const type = url.includes('spreadsheets') ? 'sheet' : 'doc';
  const uploaded_at = new Date().toISOString();
  // Persist Google link in backend
  const res = await fetch('/api/googleLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      folder: selectedFolder,
      name,
      url,
      type,
      uploaded_by: user.username,
      uploaded_at,
    }),
  });
  if (res.ok) {
    // Audit logging for Google link upload
    await fetch('/api/auditFileUpload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        folder: selectedFolder,
        file_name: name,
        uploaded_by: user.username,
        uploaded_at,
        is_google_link: true,
        url,
        type,
      }),
    });
    loadFiles(selectedFolder);
    loadAuditLogs();
  } else {
    setError('Failed to add Google link');
  }
}}
                title="Add Google Doc or Sheet"
              >
                <span style={{ fontSize: 18 }}>📄</span> Add Google Doc/Sheet
              </button>
              {uploading && <span style={{ color: '#2563eb', fontWeight: 500, marginLeft: 12 }}>Uploading...</span>}
            </div>
            <style jsx>{`
              .file-actions-row {
                display: flex;
                align-items: center;
                gap: 18px;
                margin-bottom: 18px;
                flex-wrap: wrap;
              }
              @media (max-width: 600px) {
                .file-actions-row {
                  flex-direction: column;
                  align-items: stretch;
                  gap: 10px;
                }
                .file-actions-row input,
                .file-actions-row button {
                  width: 100%;
                  min-width: 0;
                }
              }
            `}</style>
            {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
              {files.length === 0 && <div style={{ color: '#888', fontSize: 15, padding: 16, borderRadius: 8, background: '#f7fafc', textAlign: 'center' }}>No files yet.</div>}
              {files.map((file: any) => {
                // Google Doc/Sheet special rendering
                if (file.type === 'google_doc' || file.type === 'google_sheet') {
                  return (
                    <div key={file.name + file.url} style={{ background: '#f8fafc', borderRadius: 12, border: '1.5px solid #e3e7ef', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', minHeight: 80 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{file.type === 'google_sheet' ? '🟩' : '📄'}</span>
                        {(file.type === 'google_sheet' || file.type === 'google_doc') ? (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
    <span style={{ fontWeight: 600, color: '#222', fontSize: 15, marginBottom: 2, wordBreak: 'break-all' }}>{file.name}</span>
    <button
      style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
      onClick={async () => {
        // Audit log for preview
        await fetch('/api/auditFilePreview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            folder: selectedFolder,
            file_name: file.name,
            previewed_by: user.username,
            previewed_at: new Date().toISOString(),
            is_google_link: true,
            url: file.url,
            type: file.type
          })
        });
        setPreviewLogs(prev => {
          const prevEntries = prev[file.name]?.entries || [];
          if (prevEntries.some(e => e.username === user.username)) return prev;
          return {
            ...prev,
            [file.name]: { entries: [...prevEntries, { username: user.username, time: new Date().toISOString() }] }
          };
        });
        // Audit preview for Google link
        const viewedBy = previewLogs[file.name]?.entries || [];
        if (!viewedBy.find(e => e.username === user.username)) {
          await fetch('/api/auditFilePreview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: projectId,
              folder: selectedFolder,
              file_name: file.name,
              previewed_by: user.username,
              previewed_at: new Date().toISOString(),
            }),
          });
        }
        setPreviewUrl(file.url);
        setPreviewType(file.type === 'google_sheet' ? 'sheet' : 'doc');
      }}
    >Full Screen</button>
  </div>
) : (
  <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#2563eb', fontSize: 15, textDecoration: 'underline' }}>{file.name}</a>
)}
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{file.type === 'google_sheet' ? 'Google Sheet' : 'Google Doc'}</span>
                      </div>
                      <button
                        style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, position: 'absolute', top: 10, right: 10 }}
                        title="Remove link"
                        onClick={async () => {
  // Remove from DB if Google link
  if (file.type === 'google_doc' || file.type === 'google_sheet') {
    if (!window.confirm('Remove this Google Doc/Sheet link?')) return;
    // Find link id if present
    if (file.id) {
      const res = await fetch('/api/googleLink', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: file.id })
      });
      if (res.ok) {
        // Audit log for deletion
        await fetch('/api/auditFileUpload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            folder: selectedFolder,
            file_name: file.name,
            deleted_by: user.username,
            deleted_at: new Date().toISOString(),
            is_google_link: true,
            url: file.url,
            type: file.type,
            action: 'link_deleted',
          }),
        });
      }
    }
    loadFiles(selectedFolder!);
    loadAuditLogs();
  } else {
    setFiles(prev => prev.filter(f => f !== file));
  }
}}
                      >🗑️</button>
                    </div>
                  );
                }
                return (
                  <div key={file.name} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px #e3f0ff', border: '1.5px solid #e3e7ef', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', transition: 'box-shadow 0.2s', minHeight: 100 }}>
                    <div style={{ fontWeight: 600, color: '#222', fontSize: 15, marginBottom: 2, wordBreak: 'break-all' }}>{file.name}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <button
                        style={{ color: '#3182ce', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}
                        title="Download"
                        onClick={async () => {
                          const log = downloadLogs[file.name] || { usernames: [], uploaded_by: '' };
                          const isFirstDownload = user.username !== log.uploaded_by && !log.usernames.includes(user.username);
                          
                          try {
                            // Mark as seen in preview logs if not already done
                            const viewedBy = previewLogs[file.name]?.entries || [];
                            const isFirstView = !viewedBy.find(e => e.username === user.username);
                            
                            if (isFirstView) {
                              // Log the preview action (mark as seen)
                              await fetch('/api/auditFilePreview', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  project_id: projectId,
                                  folder: selectedFolder,
                                  file_name: file.name,
                                  previewed_by: user.username,
                                  previewed_at: new Date().toISOString(),
                                }),
                              });
                              
                              // Update preview logs locally
                              setPreviewLogs(prev => ({
                                ...prev,
                                [file.name]: {
                                  entries: [
                                    ...(prev[file.name]?.entries || []),
                                    { username: user.username, time: new Date().toISOString() }
                                  ]
                                }
                              }));
                            }
                            
                            if (isFirstDownload) {
                              // Log the download action
                              await fetch('/api/auditFileDownload', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  project_id: projectId,
                                  folder: selectedFolder,
                                  file_name: file.name,
                                  downloaded_by: user.username,
                                  downloaded_at: new Date().toISOString(),
                                  uploaded_by: log.uploaded_by,
                                }),
                              });
                              
                              // Update download logs locally
                              setDownloadLogs(prev => ({
                                ...prev,
                                [file.name]: {
                                  usernames: [...(prev[file.name]?.usernames || []), user.username],
                                  uploaded_by: log.uploaded_by,
                                }
                              }));
                            }
                            
                            // Refresh notifications and logs
                            window.dispatchEvent(new Event('refreshNotifications'));
                            loadAuditLogs();
                            if (onFileAction) onFileAction();
                          } catch (error) {
                            console.error('Error logging download:', error);
                          }
                          
                          // Always proceed with download
                          const { data } = supabase.storage.from('media')
                            .getPublicUrl(`projects/${projectId}/${selectedFolder}/${file.name}`);
                          window.open(data.publicUrl, '_blank');
                        }}
                      >⬇️</button>
                      <button
                        style={{ color: '#38a169', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}
                        title="Preview"
                        onClick={async () => {
                          const viewedBy = previewLogs[file.name]?.entries || [];
                          if (!viewedBy.find(e => e.username === user.username)) {
                            await fetch('/api/auditFilePreview', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                project_id: projectId,
                                folder: selectedFolder,
                                file_name: file.name,
                                previewed_by: user.username,
                                previewed_at: new Date().toISOString(),
                              }),
                            });
                            setPreviewLogs(prev => ({
                              ...prev,
                              [file.name]: {
                                entries: [
                                  ...(prev[file.name]?.entries || []),
                                  { username: user.username, time: new Date().toISOString() }
                                ]
                              }
                            }));
                            window.dispatchEvent(new Event('refreshNotifications'));
                            if (onFileAction) onFileAction();
                          }
                          const { data } = supabase.storage.from('media').getPublicUrl(`projects/${projectId}/${selectedFolder}/${file.name}`);
                          setPreviewUrl(data.publicUrl);
                          setPreviewType(file.name.match(/\.pdf$/i) ? 'pdf' : 'image');
                        }}
                      >👁️</button>
                      <button
                        style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}
                        title="Delete file"
                        onClick={async () => {
                          if (!window.confirm('Delete this file?')) return;
                          await fetch('/api/deleteFile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              project_id: projectId,
                              folder: selectedFolder,
                              file_path: `projects/${projectId}/${selectedFolder}/${file.name}`,
                              deleted_by: user.username,
                              deleted_at: new Date().toISOString(),
                            }),
                          });
                          loadFiles(selectedFolder);
                          loadAuditLogs();
                        }}
                      >🗑️</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {(() => {
  const entries = (previewLogs[file.name]?.entries || []).filter(e => e.username !== (downloadLogs[file.name]?.uploaded_by || ''));
  if (entries.length === 0) return null;
  const shown = entries.slice(0, 5);
  const more = entries.length > 5 ? entries.length - 5 : 0;
  return (
    <span style={{ background: '#f0f7ff', color: '#2563eb', fontWeight: 500, fontSize: 12, borderRadius: 8, padding: '2px 8px', marginTop: 4, display: 'inline-block' }}>
      Seen by: {shown.map(e => `${e.username}${e.time ? ` (${new Date(e.time).toLocaleString()})` : ''}`).join(', ')}{more > 0 ? ` +${more} more` : ''}
    </span>
  );
})()}

                      {(() => {
                        const allViewed = (previewLogs[file.name]?.entries || []).filter(e => e.username !== (downloadLogs[file.name]?.uploaded_by || '')).length >= 6;
                        return allViewed ? (
                          <span style={{ background: '#e6fffa', color: '#38a169', fontWeight: 600, fontSize: 12, borderRadius: 8, padding: '2px 8px' }}>All viewed</span>
                        ) : null;
                      })()}
                      {(() => {
                        const allDownloaded = (downloadLogs[file.name]?.usernames || []).filter(u => u !== downloadLogs[file.name].uploaded_by).length >= 5;
                        return allDownloaded ? (
                          <span style={{ background: '#e0e7ff', color: '#2563eb', fontWeight: 600, fontSize: 12, borderRadius: 8, padding: '2px 8px' }}>All downloaded</span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
            <hr />
            <AuditLogs key={auditRefresh} projectId={projectId} folder={selectedFolder} />
          </div>
        )}
        {previewUrl && (
  <div style={{
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  }}>
    <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: '80vw', maxHeight: '80vh', position: 'relative', minWidth: 400 }}>
      <button onClick={() => setPreviewUrl(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
      {previewType === 'image' ? (
        <img src={previewUrl} alt="preview" style={{ maxWidth: '70vw', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
      ) : previewType === 'pdf' ? (
        <iframe src={previewUrl} style={{ width: '70vw', height: '70vh', border: 'none' }} title="PDF Preview" />
      ) : previewType === 'doc' ? (
        <>
          <DocPreview url={previewUrl} name={previewUrl.split('/').pop()} />
          {(() => {
            // Find the file object for the current previewUrl
            const file = files.find(f => f.url === previewUrl);
            const entries = file && previewLogs[file.name]?.entries;
            return entries && entries.length > 0 ? (
              <div style={{ marginTop: 12, background: '#f0f7ff', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#2563eb', fontWeight: 500 }}>
                Seen by: {entries.map(e => `${e.username}${e.time ? ` (${new Date(e.time).toLocaleString()})` : ''}`).join(', ')}
              </div>
            ) : null;
          })()}
        </>
      ) : previewType === 'sheet' ? (
        <>
          <SheetPreview url={previewUrl} name={previewUrl.split('/').pop()} />
          {(() => {
            const file = files.find(f => f.url === previewUrl);
            const entries = file && previewLogs[file.name]?.entries;
            return entries && entries.length > 0 ? (
              <div style={{ marginTop: 12, background: '#f0f7ff', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#2563eb', fontWeight: 500 }}>
                Seen by: {entries.map(e => `${e.username}${e.time ? ` (${new Date(e.time).toLocaleString()})` : ''}`).join(', ')}
              </div>
            ) : null;
          })()}
        </>
      ) : null}
    </div>
  </div>
)}
      </div>
    </div>
  );
}
