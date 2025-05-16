import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface SetPasswordFormProps {
  username: string;
  onPasswordSet: () => void;
}

const SetPasswordForm: React.FC<SetPasswordFormProps> = ({ username, onPasswordSet }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password })
      .eq('username', username);
    setLoading(false);
    if (updateError) {
      setError('Failed to set password. Please try again.');
      return;
    }
    onPasswordSet();
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '0 auto', marginTop: 32 }}>
      <h2>Set Your Password</h2>
      <div style={{ marginBottom: 8 }}>
        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: 8 }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          style={{ width: '100%', padding: 8 }}
        />
      </div>
      <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
        {loading ? 'Setting...' : 'Set Password'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </form>
  );
};

export default SetPasswordForm;
