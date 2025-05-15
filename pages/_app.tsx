import React from 'react';
import type { AppProps } from 'next/app';
import '../styles/globals.css';
import '../styles/desktop.css';

import { UserProvider, useUser } from '../components/UserContext';
import { ProjectProvider } from '../components/ProjectContext';
import Notifications from '../components/Notifications';

function GlobalNotifications() {
  const { user } = useUser();
  // Show all notifications if no projectId
  return user ? <Notifications /> : null;
}

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <UserProvider>
      <ProjectProvider>
        <GlobalNotifications />
        <Component {...pageProps} />
      </ProjectProvider>
    </UserProvider>
  );
}
