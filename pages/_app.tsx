import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import '../styles/desktop.css';
import '../styles/chat.css';

import { UserProvider, useUser } from '../components/UserContext';
import { ProjectProvider } from '../components/ProjectContext';
import Notifications from '../components/Notifications';

function GlobalNotifications() {
  const { user } = useUser();
  // Show all notifications if no projectId
  return user ? <Notifications /> : null;
}

export default function MyApp({ Component, pageProps }: AppProps) {
  // Add viewport meta tag for mobile devices
  useEffect(() => {
    // Set viewport meta tag if it doesn't exist
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
      <UserProvider>
        <ProjectProvider>
          <GlobalNotifications />
          <Component {...pageProps} />
        </ProjectProvider>
      </UserProvider>
    </>
  );
}
