import React, { useState } from 'react';

const USERS = [
  { username: 'pradip', role: 'FOUNDER' },
  { username: 'shashank', role: 'FOUNDER' },
  { username: 'vikash', role: 'FOUNDER' },
  { username: 'sahil', role: 'FOUNDER' },
  { username: 'sayan', role: 'FOUNDER' },
  { username: 'rini', role: 'FOUNDER' },
];

const CORPORATE_PASSWORD = 'cvs.admin.06.'; 

export default function LoginForm({ onLogin }: { onLogin: (user: { username: string, role: string }) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const user = USERS.find(u => u.username === username);
    if (!user) {
      setError('You are not authorized to log in.');
      setLoading(false);
      return;
    }
    if (password !== CORPORATE_PASSWORD) {
      setError('Invalid password.');
      setLoading(false);
      return;
    }
    setLoading(false);
    onLogin({ username: user.username, role: user.role });
  };


  return (
    <div style={{ position: 'relative', minHeight: 320 }}>
      <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '0 auto', opacity: loading ? 0.5 : 1 }}>
        <h2>Login</h2>
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Username (e.g. pradip)"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
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
