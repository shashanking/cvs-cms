import React, { useState } from 'react';
import { useRouter } from 'next/router';
import SetPasswordForm from './SetPasswordForm';
import { supabase } from '../lib/supabaseClient';

const CORPORATE_PASSWORD = 'cvs.admin.06.'; 

export default function LoginForm({ onLogin }: { onLogin: (user: { username: string, role: string }) => void }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetStep, setResetStep] = useState<'verify' | 'set' | null>(null);

  // Handle login or password recovery submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Fetch user from the database
    // Normalize username to lowercase for both query and input
    const normalizedUsername = username.trim().toLowerCase();
    const { data, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('username', normalizedUsername);
    console.log('User query result:', data);
    if (dbError) {
      console.error('DB Error during login:', dbError);
      setError('A server error occurred. Please try again.');
      setLoading(false);
      return;
    }
    if (!data || data.length === 0) {
      setError('User not found.');
      setLoading(false);
      return;
    }
    if (data.length > 1) {
      setError('Multiple users found with this username. Please contact admin.');
      setLoading(false);
      return;
    }
    const userData = data[0];
    // If in forgot password mode, verify corporate pass
    if (forgotMode) {
      if (password !== CORPORATE_PASSWORD) {
        setError('Invalid corporate pass.');
        setLoading(false);
        console.log('Forgot mode: wrong corporate pass');
        return;
      }
      setPendingUser(userData);
      setResetStep('set');
      setLoading(false);
      console.log('Forgot mode: corporate pass valid, proceed to set new password for', userData.username);
      return;
    }
    // If user has not set a personal password (password is empty or null), allow login with corporate pass only
    if (!userData.password) {
      if (password === CORPORATE_PASSWORD) {
        setPendingUser(userData);
        setShowSetPassword(true);
        setLoading(false);
        return;
      } else {
        setError('You must use the corporate pass for your first login.');
        setLoading(false);
        return;
      }
    }
    // DEBUG: Log password check (REMOVE in production)
    console.log('Attempting login for user:', username, 'Entered password:', password, 'Stored password:', userData.password);
    // After initial login, only allow login with personal password
    if (password !== userData.password) {
      setError('Invalid password.');
      setLoading(false);
      return;
    }
    // NOTE: For security, passwords should be hashed and checked using a secure hash comparison.
    //       Storing plaintext passwords is insecure! Use bcrypt or similar libraries for hashing.
    setLoading(false);
    // Store user in localStorage for persistence
    const userObj = {
      username: userData.username,
      display_name: userData.display_name,
      role: userData.role
    };
    localStorage.setItem('cvs-cms-user', JSON.stringify(userObj));
    onLogin(userObj);
    router.push('/');
  };

  // Handle password set/reset completion
  const handlePasswordSet = async () => {
    // Fetch updated user
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('username', pendingUser.username)
      .single();
    if (data) {
      const userObj = {
        username: data.username,
        display_name: data.display_name,
        role: data.role
      };
      localStorage.setItem('cvs-cms-user', JSON.stringify(userObj));
      onLogin(userObj);
      router.push('/');
    }
  };

  // UI
  if (showSetPassword && pendingUser) {
    return (
      <SetPasswordForm username={pendingUser.username} onPasswordSet={handlePasswordSet} />
    );
  }
  if (resetStep === 'set' && pendingUser) {
    return (
      <SetPasswordForm username={pendingUser.username} onPasswordSet={() => {
        setResetStep(null);
        setForgotMode(false);
        setPendingUser(null);
        setShowSetPassword(false);
        handlePasswordSet();
      }} />
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: 340 }}>
      <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '0 auto', opacity: loading ? 0.5 : 1 }}>
        <h2>{forgotMode ? 'Reset Password' : 'Login'}</h2>
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Username (e.g. pradip)"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
            disabled={resetStep === 'set'}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <input
            type="password"
            placeholder={forgotMode ? 'Corporate Pass' : 'Password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
            disabled={resetStep === 'set'}
          />
        </div>
        <button type="submit" disabled={loading || resetStep === 'set'} style={{ width: '100%', padding: 10 }}>
          {loading ? (forgotMode ? 'Verifying...' : 'Logging in...') : (forgotMode ? (resetStep === 'set' ? 'Setting...' : 'Verify') : 'Login')}
        </button>
        {!forgotMode && (
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button type="button" style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: 0 }}
              onClick={() => {
                setForgotMode(true);
                setError(null);
                setPassword('');
                setUsername('');
              }}>
              Forgot Password?
            </button>
          </div>
        )}
        {forgotMode && (
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button type="button" style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: 0 }}
              onClick={() => {
                setForgotMode(false);
                setError(null);
                setPassword('');
                setUsername('');
                setResetStep(null);
                setPendingUser(null);
              }}>
              Back to Login
            </button>
          </div>
        )}
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </form>
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.7)',
          zIndex: 10,
        }}>
          <div className="cvs-spinner" />
          <style jsx>{`
            .cvs-spinner {
              width: 48px;
              height: 48px;
              border: 6px solid #e0e0e0;
              border-top: 6px solid #0070f3;
              border-radius: 50%;
              animation: cvs-spin 1s linear infinite;
            }
            @keyframes cvs-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
