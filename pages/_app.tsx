import React from 'react';
import type { AppProps } from 'next/app';
import '../styles/globals.css';

import { UserProvider, useUser } from '../components/UserContext';
import Notifications from '../components/Notifications';

function GlobalNotifications() {
  const { user } = useUser();
  // Show all notifications if no projectId
  return user ? <Notifications user={user} projectId={null as any} /> : null;
}

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <UserProvider>
      <GlobalNotifications />
      <Component {...pageProps} />
    </UserProvider>
  );
}
