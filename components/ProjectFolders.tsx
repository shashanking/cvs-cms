import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

// Props interface
interface ProjectFoldersProps {
  folders: string[];
  onFileAction?: () => void;  // Optional callback on file upload etc.
}

// Validate UUID to prevent invalid backend calls
function isValidUUID(uuid?: string) {
  return !!uuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export default function ProjectFolders({ folders, onFileAction }: ProjectFoldersProps) {
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;

  // State for folders from backend and UI
  const [dbFolders, setDbFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState('');

  // Fetch folders from backend on project change
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const res = await fetch(`/api/folder?project_id=${projectId}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.folders)) {
          setDbFolders(data.folders.map((f: any) => f.name));
        } else {
          setDbFolders([]);
        }
      } catch {
        setDbFolders([]);
      }
    })();
  }, [projectId]);

  // Merge props folders and db folders uniquely
  const mergedFolders = Array.from(new Set([...(folders || []), ...dbFolders]));

  // Load files in selected folder
  const loadFiles = async (folder: string) => {
    setSelectedFolder(folder);
    setError(null);

    try {
      const [storageRes, googleRes] = await Promise.all([
        supabase.storage.from('media').list(`projects/${projectId}/${folder}/`, { limit: 100 }),
        fetch(`/api/googleLink?project_id=${projectId}&folder=${encodeURIComponent(folder)}`),
      ]);

      if (storageRes.error) throw storageRes.error;

      let googleLinks = [];
      if (googleRes.ok) {
        const json = await googleRes.json();
        googleLinks = (json.links ?? []).map((link: any) => ({
          ...link,
          type: link.type === 'doc' ? 'google_doc' : 'google_sheet',
        }));
      }

      setFiles([...(storageRes.data ?? []), ...googleLinks]);
    } catch (err: any) {
      setError(err.message || 'Failed to load files.');
    }
  };

  // Add folder optimistically
  const addFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolder.trim();
    if (!trimmed || dbFolders.includes(trimmed)) return;

    setDbFolders(d => [...d, trimmed]); // Optimistic add
    setNewFolder('');
    setError(null);

    const res = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, name: trimmed, user: user?.username }),
    });

    if (!res.ok) setError('Failed to add folder');
  };

  // Delete folder optimistically
  const deleteFolder = async (folder: string) => {
    if (!window.confirm(`Delete folder '${folder}'? This will remove all files in it.`)) return;

    setDbFolders(d => d.filter(f => f !== folder)); // Optimistic remove
    setError(null);

    const res = await fetch('/api/folder', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, name: folder, user: user?.username }),
    });

    if (!res.ok) setError('Failed to delete folder');
  };

  // File upload with optimistic UI
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFolder || !e.target.files?.length) return;

    setUploading(true);
    setError(null);
    const file = e.target.files[0];
    const uniqueName = `${Date.now()}_${file.name}`;

    setFiles(curr => [...curr, { name: uniqueName }]); // Optimistic UI

    const { error } = await supabase.storage.from('media').upload(`projects/${projectId}/${selectedFolder}/${uniqueName}`, file);

    setUploading(false);
    if (error) setError(error.message);
  };

  if (!isValidUUID(projectId)) return <div style={{ color: 'red' }}>Invalid project ID</div>;

  return (
    <div style={{ margin: '4vw 0' }}>
      <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>Folders</h3>

      {/* Folder cards in horizontal scroll */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 18, paddingBottom: 8 }}>
        {mergedFolders.map(folder => (
          <div
            key={folder}
            style={{
              minWidth: 120,
              background: '#f1f5f9',
              borderRadius: 12,
              boxShadow: '0 2px 8px #e3f0ff',
              border: '1.5px solid #c3dafc',
              padding: '18px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => loadFiles(folder)}
            tabIndex={0}
            onKeyPress={e => e.key === 'Enter' && loadFiles(folder)}
          >
            <span style={{ fontSize: '2rem', color: '#2563eb', marginBottom: 6 }}>📁</span>
            <span style={{ fontWeight: 600, color: '#222', fontSize: '1rem', marginBottom: 2 }}>{folder}</span>
            {!folders.includes(folder) && (
              <button
                onClick={e => { e.stopPropagation(); deleteFolder(folder); }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: '#e53e3e',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
                title="Delete folder"
              >🗑️</button>
            )}
          </div>
        ))}
        {/* New folder input */}
        <form onSubmit={addFolder} style={{ display: 'flex', minWidth: 120 }}>
          <input
            type="text"
            value={newFolder}
            onChange={e => setNewFolder(e.target.value)}
            placeholder="New folder"
            required
            style={{ flex: 1, borderRadius: 6, border: '1.5px solid #c3dafc', padding: '8px 10px' }}
          />
          <button
            type="submit"
            disabled={!newFolder.trim()}
            style={{ borderRadius: 6, background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px' }}
          >+</button>
        </form>
      </div>

      {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

      {/* Files and upload UI */}
      {selectedFolder && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ color: '#2563eb' }}>Files in: {selectedFolder}</h4>
          <input type="file" onChange={handleUpload} disabled={uploading} />
          {uploading && <span style={{ marginLeft: 12, color: '#2563eb' }}>Uploading...</span>}

          <ul style={{ marginTop: 10 }}>
            {files.map((f: any) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
          <button onClick={() => setSelectedFolder(null)} style={{ marginTop: 12, padding: '6px 12px', cursor: 'pointer' }}>
            Back to folders
          </button>
        </div>
      )}
    </div>
  );
}
