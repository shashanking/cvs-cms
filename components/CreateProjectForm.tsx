import React from 'react';
// You can combine these into one line: import React, { useState } from 'react';
import { useState } from 'react';

// Component props definition:
// onCreated: callback function to notify parent component when a project is created.
export default function CreateProjectForm({ onCreated }: { onCreated: (project: any) => void }) {
  // State to hold the entered project name (initialized to empty string)
  const [name, setName] = useState('');
  // State for project description text
  const [description, setDescription] = useState('');
  // Loading state to indicate form submission in progress
  const [loading, setLoading] = useState(false);
  // Error message state, either null or a string describing what went wrong
  const [error, setError] = useState<string | null>(null);

  // Handler for the form submit event
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent page reload

    setLoading(true);   // Show loading indicator
    setError(null);     // Clear any existing error

    // Fetch the logged-in user's username from localStorage (assumption: user info saved there)
    const user = JSON.parse(localStorage.getItem('cvs-cms-user') || '{}');

    try {
      // Send POST request to your backend API endpoint that creates a new project
      const res = await fetch('/api/createProject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, created_by: user.username }),
      });

      const data = await res.json(); // Parse JSON response

      setLoading(false); // Done loading

      if (!res.ok) {
        // If response is an error, set error message (use backend error or fallback string)
        setError(data.error || 'Failed to create project');
      } else {
        // On success, clear form fields
        setName('');
        setDescription('');
        // Inform parent component of new project, passing project details returned from API
        onCreated(data.project);
      }
    } catch (err) {
      // If network error or exception occurs
      setLoading(false);
      setError('An unexpected error occurred');
    }
  };

  return (
    // The form HTML with controlled inputs and submit button
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <h2>Create New Project</h2>

      {/* Input for Project Name */}
      <div style={{ marginBottom: 8 }}>
        <input
          type="text"
          placeholder="Project name"
          value={name}
          onChange={e => setName(e.target.value)}
          required       // Browser will enforce non-empty input
          style={{ padding: 8, width: 300 }}
        />
      </div>

      {/* Textarea for Description */}
      <div style={{ marginBottom: 8 }}>
        <textarea
          placeholder="Project description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ padding: 8, width: 300, height: 60 }}
        />
      </div>

      {/* Submit Button with disabled/loading state */}
      <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
        {loading ? 'Creating...' : 'Create Project'}
      </button>

      {/* Error display */}
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </form>
  );
}
