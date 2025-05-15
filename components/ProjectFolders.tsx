import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import AuditLogs from './AuditLogs';
import Notifications from './Notifications';
import ProjectEvents from './ProjectEvents';

interface ProjectFoldersProps {
  projectId: string;
  folders: string[];
  user: { username: string; role: string };
}

function isValidUUID(uuid: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

interface ProjectFoldersPropsWithCallback extends ProjectFoldersProps {
  onFileAction?: () => void;
}

export default function ProjectFolders({ projectId, folders: initialFolders, user, onFileAction }: ProjectFoldersPropsWithCallback) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [previewLogs, setPreviewLogs] = useState<Record<string, { usernames: string[] }>>({}); // fileName: { usernames }
  const [downloadLogs, setDownloadLogs] = useState<Record<string, { usernames: string[]; uploaded_by: string }>>({}); // fileName: { usernames, uploaded_by }
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditRefresh, setAuditRefresh] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [newFolder, setNewFolder] = useState<string>('');
  const [folderLoading, setFolderLoading] = useState<string | null>(null);

  // Fetch folders from DB on mount or projectId change
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const res = await fetch('/api/folder?project_id=' + projectId);
      const data = await res.json();
      if (res.ok && Array.isArray(data.folders)) {
        setFolders(data.folders.map((f: any) => f.name));
      } else {
        setFolders([]);
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
    const { data, error } = await supabase.storage.from('media').list(`projects/${projectId}/${folder}/`, { limit: 100 });
    if (error) setError(error.message);
    setFiles(data || []);
    // Fetch preview logs for all files in this folder
    const { data: logs } = await supabase
      .from('file_upload_audit')
      .select('file_name, viewed_by_users')
      .eq('project_id', projectId)
      .eq('folder', folder)
      .eq('action', 'preview');
    const logMap: Record<string, { usernames: string[] }> = {};
    if (logs) {
      logs.forEach((log: any) => {
        if (log.file_name && Array.isArray(log.viewed_by_users)) {
          const usernames = log.viewed_by_users.map((entry: any) => entry.username);
          logMap[log.file_name] = { usernames };
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
      <ProjectEvents projectId={projectId} user={user} />
      <Notifications projectId={projectId} user={user} />
      <div>
        {(!selectedFolder) ? (
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 18, color: '#2563eb', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.5rem' }}>🗂️</span> Folders
            </h3>
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <div style={{ display: 'flex', overflowX: 'auto', gap: 18, paddingBottom: 8 }}>
                {folders.map(folder => (
                  <div key={folder} style={{ minWidth: 120, background: '#f1f5f9', borderRadius: 12, boxShadow: '0 2px 8px #e3f0ff', border: '1.5px solid #c3dafc', padding: '18px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', transition: 'box-shadow 0.2s', cursor: 'pointer' }}
                    onClick={() => loadFiles(folder)}
                    tabIndex={0}
                    onKeyPress={e => (e.key === 'Enter' ? loadFiles(folder) : undefined)}
                  >
                    <span style={{ fontSize: '2rem', color: '#2563eb', marginBottom: 6 }}>📁</span>
                    <span style={{ fontWeight: 600, color: '#222', fontSize: '1rem', marginBottom: 2 }}>{folder}</span>
                    <span style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{/* File count badge placeholder */}</span>
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
                          setFolders((prev) => prev.filter(f => f !== folder));
                        } else {
                          const data = await res.json();
                          setError(data.error || 'Could not delete folder');
                        }
                        setFolderLoading(null);
                      }}
                      disabled={!!folderLoading}
                    >🗑️</button>
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', right: 0, top: '-50px', display: 'flex', gap: 6 }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const folderName = newFolder.trim();
                    if (!folderName || folders.includes(folderName)) return;
                    setFolderLoading(folderName);
                    const res = await fetch('/api/folder', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ project_id: projectId, name: folderName, user: user.username })
                    });
                    const data = await res.json();
                    if (res.ok && data.folder) {
                      setFolders((prev) => [...prev, data.folder.name]);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18 }}>
              <input type="file" onChange={handleUpload} disabled={uploading} style={{ fontSize: 15 }} />
              {uploading && <span style={{ color: '#2563eb', fontWeight: 500 }}>Uploading...</span>}
            </div>
            {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
              {files.length === 0 && <div style={{ color: '#888', fontSize: 15, padding: 16, borderRadius: 8, background: '#f7fafc', textAlign: 'center' }}>No files yet.</div>}
              {files.map((file: any) => {
                const allViewed = Array.isArray(previewLogs[file.name]?.usernames) && previewLogs[file.name].usernames.length >= 6;
                const allDownloaded = Array.isArray(downloadLogs[file.name]?.usernames) && downloadLogs[file.name]?.uploaded_by && downloadLogs[file.name].usernames.filter(u => u !== downloadLogs[file.name].uploaded_by).length >= 5;
                return (
                  <div key={file.name} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px #e3f0ff', border: '1.5px solid #e3e7ef', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', transition: 'box-shadow 0.2s', minHeight: 100 }}>
                    <div style={{ fontWeight: 600, color: '#222', fontSize: 15, marginBottom: 2, wordBreak: 'break-all' }}>{file.name}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <button
                        style={{ color: '#3182ce', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}
                        title="Download"
                        onClick={async () => {
                          const log = downloadLogs[file.name] || { usernames: [], uploaded_by: '' };
                          if (user.username !== log.uploaded_by && !log.usernames.includes(user.username)) {
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
                            setDownloadLogs(prev => ({
                              ...prev,
                              [file.name]: {
                                usernames: [...(prev[file.name]?.usernames || []), user.username],
                                uploaded_by: log.uploaded_by,
                              }
                            }));
                            loadAuditLogs();
                          }
                          const { data } = supabase.storage.from('media').getPublicUrl(`projects/${projectId}/${selectedFolder}/${file.name}`);
                          window.open(data.publicUrl, '_blank');
                        }}
                      >⬇️</button>
                      <button
                        style={{ color: '#38a169', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}
                        title="Preview"
                        onClick={async () => {
                          const viewedBy = previewLogs[file.name]?.usernames || [];
                          if (!viewedBy.includes(user.username)) {
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
                            setPreviewLogs(prev => ({ ...prev, [file.name]: { usernames: [...(prev[file.name]?.usernames || []), user.username] } }));
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
                      {allViewed && <span style={{ background: '#e6fffa', color: '#38a169', fontWeight: 600, fontSize: 12, borderRadius: 8, padding: '2px 8px' }}>All viewed</span>}
                      {allDownloaded && <span style={{ background: '#e0e7ff', color: '#2563eb', fontWeight: 600, fontSize: 12, borderRadius: 8, padding: '2px 8px' }}>All downloaded</span>}
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
            <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: '80vw', maxHeight: '80vh', position: 'relative' }}>
              <button onClick={() => setPreviewUrl(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
              {previewType === 'image' ? (
                <img src={previewUrl} alt="preview" style={{ maxWidth: '70vw', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
              ) : previewType === 'pdf' ? (
                <iframe src={previewUrl} style={{ width: '70vw', height: '70vh', border: 'none' }} title="PDF Preview" />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
