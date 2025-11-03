import React, { useState } from 'react';

// Added imports for Material UI components:
import {
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
  Paper,
} from '@mui/material';

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
    e.preventDefault();
    setLoading(true);
    setError(null);
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
    // Changed from <form> with inline styles to MUI Paper component for padding, shadow, and max width
    <Paper
      component="form"
      onSubmit={handleSubmit}
      sx={{
        p: 3,             // padding around form
        mb: 3,            // margin bottom below form
        maxWidth: 400,     // max width for better readability
        mx: 'auto',       // center horizontally
      }}
      elevation={3}       // subtle shadow
    >
      {/* Changed plain <h2> to MUI Typography for better typography and margin */}
      <Typography variant="h6" component="h2" gutterBottom>
        Create New Project
      </Typography>

      {/* Changed plain <input> to MUI TextField with label, fullWidth, and outlined style */}
      <TextField
        label="Project Name"
        variant="outlined"
        fullWidth
        required
        value={name}
        onChange={e => setName(e.target.value)}
        sx={{ mb: 2 }}   // margin bottom for spacing
      />

      {/* Changed plain <textarea> to multiline MUI TextField with label */}
      <TextField
        label="Project Description"
        variant="outlined"
        fullWidth
        multiline
        minRows={3}
        value={description}
        onChange={e => setDescription(e.target.value)}
        sx={{ mb: 2 }}
      />

      {/* Encapsulated submit button and loading spinner */}
      <Box sx={{ position: 'relative' }}>
        {/* Changed plain button to MUI Button with full width, variant, disabled during loading */}
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={loading}
          fullWidth
          size="large"
        >
          {loading ? 'Creating...' : 'Create Project'}
        </Button>

        {/* Added circular loading spinner on top of button when loading */}
        {loading && (
          <CircularProgress
            size={24}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: '-12px',
              marginLeft: '-12px',
            }}
          />
        )}
      </Box>

      {/* Changed error display to MUI Typography with error color and margin */}
      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Paper>
  );
}
