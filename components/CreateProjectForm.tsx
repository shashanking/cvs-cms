import React from 'react';
import { useState } from 'react';

export default function CreateProjectForm({ onCreated }: { onCreated: (project: any) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Get user from localStorage
    const user = JSON.parse(localStorage.getItem('cvs-cms-user') || '{}');
    const res = await fetch('/api/createProject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, created_by: user.username }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Failed to create project');
    } else {
      setName('');
      setDescription('');
      onCreated(data.project);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <h2>Create New Project</h2>
      <div style={{ marginBottom: 8 }}>
        <input
          type="text"
          placeholder="Project name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ padding: 8, width: 300 }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <textarea
          placeholder="Project description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ padding: 8, width: 300, height: 60 }}
        />
      </div>
      <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
        {loading ? 'Creating...' : 'Create Project'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </form>
  );
}
