// pages/_app.tsx
import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';

// Import global CSS
import '../styles/globals.css';
import '../styles/desktop.css';
import '../styles/chat.css';

// Import your contexts and components
import { UserProvider, useUser } from '../components/UserContext';
import { ProjectProvider } from '../components/ProjectContext';
import TopBar from '../components/TopBar';


// Error Boundary implementation
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    // Update state to render fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error (could be sent to external monitoring)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when an error happens
      return (
        <div
          style={{
            padding: 20,
            textAlign: 'center',
            color: 'red',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <h1>Something went wrong.</h1>
          <p>Please refresh the page or try again later.</p>
        </div>
      );
    }

    // Render children normally if no error
    return this.props.children;
  }
}

// Wrapper to use contexts and top bar with logout
function AppWrapper({ Component, pageProps }: AppProps) {
  const { user, setUser } = useUser();

  // Centralized logout handler
  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cvs-cms-user');
    }
  };

  return (
    <>
      {/* Fixed TopBar with notifications and logout only if user is logged in */}
      {user && <TopBar user={user} onLogout={logout} />}

      {/* Padding to prevent content overlap with the fixed TopBar */}
      <div style={{ paddingTop: user ? 1 : 0 }}>

        <Component {...pageProps} />
      </div>
    </>
  );
}

export default function MyApp(props: AppProps) {
  useEffect(() => {
    // Add viewport meta tag for mobile if not present
    if (!document.querySelector('meta[name="viewport"]')) {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <>
      <Head>
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <ErrorBoundary>
        <UserProvider>
          <ProjectProvider>
            <AppWrapper {...props} />
          </ProjectProvider>
        </UserProvider>
      </ErrorBoundary>
    </>
  );
}
