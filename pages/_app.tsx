// pages/_app.tsx
import React, { useEffect, memo } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';

// Import global CSS
import '../styles/globals.css';
import '../styles/desktop.css';
import '../styles/chat.css';

// Import your contexts and components
import { UserProvider, useUser } from '../components/UserContext';
import { ProjectProvider } from '../components/ProjectContext';
import Notifications from '../components/Notifications';

// Optional: Simple global error boundary to catch JavaScript errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, textAlign: 'center', color: 'red' }}>
          <h1>Something went wrong.</h1>
          <p>Please refresh the page or try again later.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Memoized GlobalNotifications component to avoid unnecessary rerenders
const GlobalNotifications = memo(() => {
  const { user, loading } = useUser();

  if (loading) {
    return <div style={{ padding: 10, textAlign: 'center' }}>Loading...</div>;
  }

  return user ? <Notifications /> : null;
});

export default function MyApp({ Component, pageProps }: AppProps) {
  // Optional: You can add client-side meta tag insertion here or better add it in _document.tsx (recommended)
  useEffect(() => {
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
            <GlobalNotifications />
            <Component {...pageProps} />
          </ProjectProvider>
        </UserProvider>
      </ErrorBoundary>
    </>
  );
}
