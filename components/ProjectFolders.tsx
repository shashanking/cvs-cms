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
      {/* Project Events Section */}
      <ProjectEvents projectId={projectId} user={user} />
      <Notifications projectId={projectId} user={user} />
      {!selectedFolder ? (
        <div>
          <h3 style={{ fontSize: '5vw', marginBottom: '3vw', color: '#2b6cb0' }}>Folders</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const folderName = newFolder.trim();
              if (!folderName || folders.includes(folderName)) return;
              setFolderLoading(folderName);
              // Call API to create folder in DB and storage
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
            style={{ marginBottom: 16 }}
          >
            <input
              type="text"
              value={newFolder}
              onChange={e => setNewFolder(e.target.value)}
              placeholder="New folder name"
              style={{ padding: 6, marginRight: 8 }}
              disabled={!!folderLoading}
            />
            <button type="submit" disabled={!newFolder.trim() || !!folderLoading} style={{ padding: '6px 12px' }}>
              {folderLoading ? 'Adding...' : 'Add Folder'}
            </button>
          </form>
          <ul>
            {folders.map(folder => (
              <li key={folder} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => loadFiles(folder)} style={{ cursor: 'pointer', padding: 8, borderRadius: 6, border: '1px solid #ccc', background: '#f9f9f9' }}>
                  {folder}
                </button>
                <button
                  style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
                  title="Delete folder"
                  onClick={async () => {
                    if (!window.confirm(`Delete folder '${folder}' and all its files?`)) return;
                    setFolderLoading(folder);
                    // Call API to delete folder from DB and storage
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
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedFolder(null)} style={{ marginBottom: 12 }}>Back to Folders</button>
          <h3>Files in {selectedFolder}</h3>
          <input type="file" onChange={handleUpload} disabled={uploading} />
          {uploading && <span style={{ marginLeft: 12 }}>Uploading...</span>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
          <ul>
            {files.length === 0 && <li>No files yet.</li>}
            {files.map((file: any) => (
              <li key={file.name}>
                {file.name}
                <button
                  style={{ marginLeft: 8, color: '#3182ce', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={async () => {
                    const log = downloadLogs[file.name] || { usernames: [], uploaded_by: '' };
                    // Only allow if not already downloaded and not uploader
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
                      // Update local downloadLogs
                      setDownloadLogs(prev => ({
                        ...prev,
                        [file.name]: {
                          usernames: [...(prev[file.name]?.usernames || []), user.username],
                          uploaded_by: log.uploaded_by,
                        }
                      }));
                      loadAuditLogs();
                    }
                    // Get public URL for download
                    const { data } = supabase.storage.from('media').getPublicUrl(`projects/${projectId}/${selectedFolder}/${file.name}`);
                    window.open(data.publicUrl, '_blank');
                  }}
                >Download</button>
                {/* Visual indicator if all other 5 users (excluding uploader) have downloaded */}
                {Array.isArray(downloadLogs[file.name]?.usernames) && downloadLogs[file.name]?.uploaded_by &&
                  downloadLogs[file.name].usernames.filter(u => u !== downloadLogs[file.name].uploaded_by).length >= 5 && (
                    <span title="All other members downloaded" style={{ marginLeft: 4, color: '#3182ce', fontWeight: 'bold' }}>⬇️✔️</span>
                )}
                {(file.name.match(/\.(jpg|jpeg|png|gif|pdf)$/i)) && (
                  <>
                    <button
                      style={{ marginLeft: 8, color: '#38a169', background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={async () => {
                        const viewedBy = previewLogs[file.name]?.usernames || [];
                        if (!viewedBy.includes(user.username)) {
                          await fetch('/api/auditFilePreview', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              project_id: projectId,
                              folder: selectedFolder,
                              file_name: file.name, // file.name is the uniqueFileName
                              previewed_by: user.username,
                              previewed_at: new Date().toISOString(),
                            }),
                          });
                          // Update local previewLogs
                          setPreviewLogs(prev => ({ ...prev, [file.name]: { usernames: [...(prev[file.name]?.usernames || []), user.username] } }));
                          if (onFileAction) onFileAction();
                        }
                        const { data } = supabase.storage.from('media').getPublicUrl(`projects/${projectId}/${selectedFolder}/${file.name}`);
                        setPreviewUrl(data.publicUrl);
                        setPreviewType(file.name.match(/\.pdf$/i) ? 'pdf' : 'image');
                      }}
                    >Preview</button>
                    {/* Visual indicator if all 6 users have viewed */}
                    {Array.isArray(previewLogs[file.name]?.usernames) && previewLogs[file.name].usernames.length >= 6 && (
                      <span title="All members viewed" style={{ marginLeft: 4, color: '#38a169', fontWeight: 'bold' }}>✔️</span>
                    )}
                  </>
                )}
                <button
                  style={{ marginLeft: 8, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer' }}
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
                >Delete</button>
              </li>
            ))}
          </ul>
          <hr />
          <AuditLogs key={auditRefresh} projectId={projectId} folder={selectedFolder} />
        </div>
      )}
      {/* Preview Modal */}
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
  );
}
