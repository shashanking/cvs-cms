import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface SetPasswordFormProps {
  username: string;
  onPasswordSet: () => void;
}

export default function SetPasswordForm({ username, onPasswordSet }: SetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    // WARNING: This sends plain text password to DB; in production use backend hashing
    const { error: updateError } = await supabase.from('users')
      .update({ password })
      .eq('username', username.trim().toLowerCase());

    setLoading(false);

    if (updateError) {
      setError('Failed to set password. Please try again.');
      return;
    }

    onPasswordSet();
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '2rem auto' }}>
      <h2>Set Your Password</h2>

      <input
        type="password"
        placeholder="New Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        disabled={loading}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      <input
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        required
        disabled={loading}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      <button type="submit" disabled={loading} style={{ width: '100%', padding: 10, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? 'Setting...' : 'Set Password'}
      </button>

      {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
    </form>
  );
}
