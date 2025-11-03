import React, { useState } from 'react';
// Next.js useRouter hook to programmatically navigate after login
import { useRouter } from 'next/router';

// Import SetPasswordForm component shown for password setting/reset flows
import SetPasswordForm from './SetPasswordForm';

// Supabase client to query your backend database
import { supabase } from '../lib/supabaseClient';

const CORPORATE_PASSWORD = 'cvs.admin.05.'; 

// Define LoginForm component with an onLogin callback prop that receives user info on successful login
export default function LoginForm({ onLogin }: { onLogin: (user: { username: string, role: string }) => void }) {
  // Next.js router instance for page navigation
  const router = useRouter();

  // State hooks for username and password inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // State for showing error messages (string or null when no error)
  const [error, setError] = useState<string | null>(null);

  // Loading state to disable inputs and show spinner/UI feedback
  const [loading, setLoading] = useState(false);

  // Controls whether to show the SetPassword form (for new users or during reset)
  const [showSetPassword, setShowSetPassword] = useState(false);

  // Holds user data temporarily during password setting/reset flows
  const [pendingUser, setPendingUser] = useState<any>(null);

  // Flag to toggle "forgot password" mode UI
  const [forgotMode, setForgotMode] = useState(false);

  // Indicates current step in password reset flow: verifying corporate pass or setting new password
  const [resetStep, setResetStep] = useState<'verify' | 'set' | null>(null);


  // Main form submit handler for login and password recovery
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();         // Prevent default form reload on submit
    setError(null);             // Clear any previous error
    setLoading(true);           // Show loading UI

    // Normalize username: trim whitespace and lowercase for consistent DB query
    const normalizedUsername = username.trim().toLowerCase();

    // Fetch user from Supabase 'users' table by username
    const { data, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('username', normalizedUsername);

    console.log('User query result:', data);

    if (dbError) {
      // Handle DB errors gracefully
      console.error('DB Error during login:', dbError);
      setError('A server error occurred. Please try again.');
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      // No user found with that username
      setError('User not found.');
      setLoading(false);
      return;
    }

    if (data.length > 1) {
      // This should not happen, but handle duplicate usernames safely
      setError('Multiple users found with this username. Please contact admin.');
      setLoading(false);
      return;
    }

    // Grab the single matching user data
    const userData = data[0];

    // === Forgot password flow ===
    if (forgotMode) {
      // Check submitted password matches corporate override password
      if (password !== CORPORATE_PASSWORD) {
        setError('Invalid corporate pass.');
        setLoading(false);
        console.log('Forgot mode: wrong corporate pass');
        return;
      }

      // Store user in state for next step and advance to set new password UI
      setPendingUser(userData);
      setResetStep('set');
      setLoading(false);
      console.log('Forgot mode: corporate pass valid, proceed to set new password for', userData.username);
      return;
    }

    // === First login flow: user has no personal password yet ===
    // Only corporate password can be used initially
    if (!userData.password) {
      if (password === CORPORATE_PASSWORD) {
        setPendingUser(userData);
        setShowSetPassword(true);   // Show set password form for new users
        setLoading(false);
        return;
      } else {
        setError('You must use the corporate pass for your first login.');
        setLoading(false);
        return;
      }
    }

    // DEBUG LOG - temporary: remove before production
    console.log('Attempting login for user:', username, 'Entered password:', password, 'Stored password:', userData.password);

    // Validate password match — currently plaintext comparison (VERY insecure!)
    if (password !== userData.password) {
      setError('Invalid password.');
      setLoading(false);
      return;
    }

    // === SUCCESSFUL LOGIN BELOW ===

    // TODO: IMPORTANT SECURITY NOTE  
    // For production:
    // - Never store or compare plaintext passwords
    // - Use hashing (e.g., bcrypt) and secure comparison
    // - Password storage/verification should be done server-side, not client

    setLoading(false);

    // Create user object to store in localStorage and pass back to parent
    const userObj = {
      username: userData.username,
      display_name: userData.display_name,
      role: userData.role
    };

    // Save logged-in user info for session persistence
    localStorage.setItem('cvs-cms-user', JSON.stringify(userObj));

    // Notify parent component about successful login
    onLogin(userObj);

    // Redirect to home page
    router.push('/');
  };


  // Handler called when user completes setting a new password in SetPasswordForm
  const handlePasswordSet = async () => {
    // Reload updated user data from DB after password set
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('username', pendingUser.username)
      .single();

    if (data) {
      // Construct updated user object, save to localStorage, notify parent and redirect
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


  // UI: If we are showing password set form after first login or password reset
  if (showSetPassword && pendingUser) {
    return (
      <SetPasswordForm username={pendingUser.username} onPasswordSet={handlePasswordSet} />
    );
  }

  // UI: During forgot password flow reset step "set", show SetPasswordForm with reset completion handler
  if (resetStep === 'set' && pendingUser) {
    return (
      <SetPasswordForm username={pendingUser.username} onPasswordSet={() => {
        // Reset all flags once new password is set
        setResetStep(null);
        setForgotMode(false);
        setPendingUser(null);
        setShowSetPassword(false);
        // Log user in after password set
        handlePasswordSet();
      }} />
    );
  }


  // === MAIN LOGIN / FORGOT PASSWORD FORM UI ===
  return (
    <div style={{ position: 'relative', minHeight: 340 }}>
      <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '0 auto', opacity: loading ? 0.5 : 1 }}>
        <h2>{forgotMode ? 'Reset Password' : 'Login'}</h2>

        {/* Username input */}
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Username (e.g. pradip)"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
            disabled={resetStep === 'set'}  // Disable during password set step
          />
        </div>

        {/* Password or Corporate Pass input */}
        <div style={{ marginBottom: 8 }}>
          <input
            type="password"
            placeholder={forgotMode ? 'Corporate Pass' : 'Password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
            disabled={resetStep === 'set'}  // Disable during password set step
          />
        </div>

        {/* Submit button */}
        <button type="submit" disabled={loading || resetStep === 'set'} style={{ width: '100%', padding: 10 }}>
          {loading ? (forgotMode ? 'Verifying...' : 'Logging in...') : (forgotMode ? (resetStep === 'set' ? 'Setting...' : 'Verify') : 'Login')}
        </button>

        {/* Toggle forgot password mode button shown only when NOT in forgot mode */}
        {!forgotMode && (
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              type="button"
              style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: 0 }}
              onClick={() => {
                setForgotMode(true);
                setError(null);
                setPassword('');
                setUsername('');
              }}
            >
              Forgot Password?
            </button>
          </div>
        )}

        {/* Back button in forgot password mode */}
        {forgotMode && (
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              type="button"
              style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: 0 }}
              onClick={() => {
                setForgotMode(false);
                setError(null);
                setPassword('');
                setUsername('');
                setResetStep(null);
                setPendingUser(null);
              }}
            >
              Back to Login
            </button>
          </div>
        )}

        {/* Display error messages */}
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </form>

      {/* Loading Spinner Overlay */}
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
          {/* CSS spinner */}
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
