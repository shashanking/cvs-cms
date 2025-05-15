import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface NotificationsProps {
  projectId: string;
  user: { username: string; role: string };
}

interface NotificationItem {
  file_name: string;
  folder: string;
  uploaded_by: string;
  uploaded_at: string;
  project_id: string;
}

const Notifications: React.FC<NotificationsProps> = ({ projectId, user }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [eventNotifications, setEventNotifications] = useState<any[]>([]); // event notifications
  const [showBanner, setShowBanner] = useState<NotificationItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewedMap, setViewedMap] = useState<Record<string, string[]>>({});
  const [downloadedMap, setDownloadedMap] = useState<Record<string, string[]>>({});
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});

  // Fetch all files uploaded by others that the user has not previewed
  const fetchNotifications = async () => {
    // Prevent fetch if projectId is not valid
    if (!projectId || projectId === 'null' || projectId === 'undefined') {
      // eslint-disable-next-line no-console
      console.warn('Skipping event notification fetch: invalid projectId', projectId);
      setEventNotifications([]);
      return;
    }
    // Fetch event notifications for this user
    const { data: eventNotifs, error: eventNotifError } = await supabase
      .from('event_notifications')
      .select('*')
      .eq('project_id', projectId)
      .eq('username', user.username)
      .eq('read', false)
      .order('created_at', { ascending: true });
    if (eventNotifError) {
      // eslint-disable-next-line no-console
      console.error('Event notification fetch error:', eventNotifError);
    } else {
      // eslint-disable-next-line no-console
      console.log('Fetched event notifications:', eventNotifs);
    }
    setEventNotifications(eventNotifs || []);
    let uploads, previews, downloads;
    if (projectId) {
      // Project-specific notifications
      uploads = (await supabase
        .from('file_upload_audit')
        .select('file_name, folder, uploaded_by, uploaded_at, project_id')
        .eq('project_id', projectId)
        .eq('action', 'upload')).data;
      previews = (await supabase
        .from('file_upload_audit')
        .select('file_name, viewed_by_users, project_id')
        .eq('project_id', projectId)
        .eq('action', 'preview')).data;
      downloads = (await supabase
        .from('file_upload_audit')
        .select('file_name, downloaded_by_users, project_id')
        .eq('project_id', projectId)
        .eq('action', 'download')).data;
    } else {
      // All-projects notifications
      uploads = (await supabase
        .from('file_upload_audit')
        .select('file_name, folder, uploaded_by, uploaded_at, project_id')
        .eq('action', 'upload')).data;
      previews = (await supabase
        .from('file_upload_audit')
        .select('file_name, viewed_by_users, project_id')
        .eq('action', 'preview')).data;
      downloads = (await supabase
        .from('file_upload_audit')
        .select('file_name, downloaded_by_users, project_id')
        .eq('action', 'download')).data;
      // Fetch all project names for mapping
      const { data: projectsData } = await supabase.from('projects').select('id, name');
      if (projectsData) {
        const mapping: Record<string, string> = {};
        projectsData.forEach((p: any) => {
          mapping[p.id] = p.name;
        });
        setProjectNames(mapping);
      }
    }
    // Map by file_name only (ignore folder)
    const newViewedMap: Record<string, string[]> = {};
    if (previews) {
      previews.forEach((p: any) => {
        if (!newViewedMap[p.file_name]) newViewedMap[p.file_name] = [];
        if (Array.isArray(p.viewed_by_users)) {
          p.viewed_by_users.forEach((v: any) => {
            if (!newViewedMap[p.file_name].includes(v.username)) {
              newViewedMap[p.file_name].push(v.username);
            }
          });
        }
      });
    }
    setViewedMap(newViewedMap);
    const newDownloadedMap: Record<string, string[]> = {};
    if (downloads) {
      downloads.forEach((d: any) => {
        if (!newDownloadedMap[d.file_name]) newDownloadedMap[d.file_name] = [];
        if (Array.isArray(d.downloaded_by_users)) {
          d.downloaded_by_users.forEach((v: any) => {
            if (!newDownloadedMap[d.file_name].includes(v.username)) {
              newDownloadedMap[d.file_name].push(v.username);
            }
          });
        }
      });
    }
    setDownloadedMap(newDownloadedMap);

    // Show all files uploaded by others
    const allNotifs = (uploads || []).filter((u: any) => u.uploaded_by !== user.username);
    setNotifications(allNotifs.filter((u: any) => {
      // Gather all usernames from ALL preview logs for this file_name
      const allViewedUsernames = (previews || [])
        .filter((p: any) => p.file_name === u.file_name)
        .flatMap((p: any) => Array.isArray(p.viewed_by_users) ? p.viewed_by_users.map((v: any) => v.username) : []);
      const allDownloadedUsernames = (downloads || [])
        .filter((d: any) => d.file_name === u.file_name)
        .flatMap((d: any) => Array.isArray(d.downloaded_by_users) ? d.downloaded_by_users.map((v: any) => v.username) : []);
      const isViewed = allViewedUsernames.includes(user.username);
      const isDownloaded = allDownloadedUsernames.includes(user.username);
      return !(isViewed || isDownloaded);
    }));
    // Show banner for the latest unread notification
    const unread = allNotifs.filter((u: any) => {
      const allViewedUsernames = (previews || [])
        .filter((p: any) => p.file_name === u.file_name)
        .flatMap((p: any) => Array.isArray(p.viewed_by_users) ? p.viewed_by_users.map((v: any) => v.username) : []);
      const allDownloadedUsernames = (downloads || [])
        .filter((d: any) => d.file_name === u.file_name)
        .flatMap((d: any) => Array.isArray(d.downloaded_by_users) ? d.downloaded_by_users.map((v: any) => v.username) : []);
      const isViewed = allViewedUsernames.includes(user.username);
      const isDownloaded = allDownloadedUsernames.includes(user.username);
      return !(isViewed || isDownloaded);
    });
    // Show a banner for each unread file, in sequence
    if (unread.length > 0) {
      let i = 0;
      const showNextBanner = () => {
        setShowBanner(unread[i]);
        setTimeout(() => {
          setShowBanner(null);
          i++;
          if (i < unread.length) {
            setTimeout(showNextBanner, 600); // short gap between banners
          }
        }, 3000);
      };
      showNextBanner();
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Listen for custom event to trigger notification refresh
    const handler = () => fetchNotifications();
    window.addEventListener('refresh-notifications', handler);
    return () => {
      window.removeEventListener('refresh-notifications', handler);
    };
  
    // Subscribe to real-time upload updates (to show notification)
    const channel = supabase.channel('file_upload_audit_notify')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'file_upload_audit',
        filter: `action=eq.upload`
      }, (payload) => {
        const newUpload = payload.new;
        if (newUpload && newUpload.uploaded_by !== user.username) {
          setShowBanner({
            file_name: newUpload.file_name,
            folder: newUpload.folder,
            uploaded_by: newUpload.uploaded_by,
            uploaded_at: newUpload.uploaded_at,
            project_id: newUpload.project_id,
          });
          setTimeout(() => setShowBanner(null), 4000);
        }
        fetchNotifications(); // ensure real-time update
      })
      .subscribe();
    // Subscribe to real-time preview updates (to remove notification)
    const channel2 = supabase.channel('file_upload_audit_preview_notify')
      .on('postgres_changes', {
        event: '*', // listen to all preview changes
        schema: 'public',
        table: 'file_upload_audit',
        filter: `action=eq.preview`
      }, (payload) => {
        fetchNotifications();
      })
      .subscribe();
    // Subscribe to real-time download updates (to remove notification)
    const channel3 = supabase.channel('file_upload_audit_download_notify')
      .on('postgres_changes', {
        event: '*', // listen to all download changes
        schema: 'public',
        table: 'file_upload_audit',
        filter: `action=eq.download`
      }, (payload) => {
        fetchNotifications();
      })
      .subscribe();
    return () => {
      channel.unsubscribe();
      channel2.unsubscribe();
      channel3.unsubscribe();
      window.removeEventListener('refresh-notifications', handler);
    };
  }, [projectId, user.username]);

  return (
    <>
      {/* Top notification banner as toast */}
      {showBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', background: '#3182ce', color: '#fff', zIndex: 2000,
          padding: '12px 0', textAlign: 'center', fontWeight: 'bold', fontSize: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          New file uploaded: {showBanner.file_name} in {showBanner.folder}
        </div>
      )}
      {/* Notification bell icon */}
      <button
        aria-label="Toggle notifications"
        style={{
          position: 'fixed',
          top: 18,
          right: 28,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          zIndex: 2100,
          fontSize: 28,
          color: '#3182ce',
          outline: 'none',
        }}
        onClick={() => setSidebarOpen(v => !v)}
      >
        <span role="img" aria-label="Notifications">🔔</span>
        {/* Show badge for unread file or event notifications */}
        {(notifications.filter(n => {
          const isViewed = viewedMap[n.file_name] && viewedMap[n.file_name].includes(user.username);
          const isDownloaded = downloadedMap[n.file_name] && downloadedMap[n.file_name].includes(user.username);
          return !(isViewed || isDownloaded);
        }).length + eventNotifications.length) > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: '#e53e3e',
            color: '#fff',
            borderRadius: '50%',
            width: 18,
            height: 18,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
          }}>{notifications.filter(n => {
            const isViewed = viewedMap[n.file_name] && viewedMap[n.file_name].includes(user.username);
            const isDownloaded = downloadedMap[n.file_name] && downloadedMap[n.file_name].includes(user.username);
            return !(isViewed || isDownloaded);
          }).length + eventNotifications.length}</span>
        )}
      </button>
      {/* Sidebar notification drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: sidebarOpen ? 0 : '-370px',
          width: 350,
          height: '100vh',
          background: '#fff',
          boxShadow: sidebarOpen ? '-2px 0 16px rgba(0,0,0,0.15)' : 'none',
          zIndex: 2050,
          transition: 'right 0.3s cubic-bezier(.4,0,.2,1)',
          borderLeft: sidebarOpen ? '1px solid #3182ce' : 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
        aria-hidden={!sidebarOpen}
        tabIndex={sidebarOpen ? 0 : -1}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '18px 20px 8px 20px', borderBottom: '1px solid #eee' }}>
          <h4 style={{ color: '#3182ce', margin: 0 }}>Notifications</h4>
        </div>
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          {(eventNotifications.length === 0 && notifications.length === 0) ? (
            <div style={{ color: '#888' }}>No notifications</div>
          ) : (
            projectId ? (
              <React.Fragment>
                {/* Show event notifications first */}
                {eventNotifications.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {eventNotifications.map(ev => (
                      <li
                        key={ev.id}
                        style={{
                          marginBottom: 12,
                          background: '#fffbe6',
                          borderRadius: 6,
                          padding: '8px 10px',
                          border: '1.5px solid #ecc94b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <strong>Event:</strong> {ev.event_topic}<br />
                          <span style={{ fontSize: 13, color: '#666' }}>by {ev.username} at {ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}</span>
                        </div>
                        <span style={{
                          background: ev.read ? '#38a169' : '#ecc94b',
                          color: '#222',
                          borderRadius: 12,
                          padding: '2px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          marginLeft: 10,
                          minWidth: 54,
                          textAlign: 'center',
                        }}>{ev.read ? 'Read' : 'Unread'}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Then show file notifications */}
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3vw',
                }}>
                  {notifications.map(n => {
                    const isViewed = viewedMap[n.file_name] && viewedMap[n.file_name].includes(user.username);
                    const isDownloaded = downloadedMap[n.file_name] && downloadedMap[n.file_name].includes(user.username);
                    const isRead = isViewed || isDownloaded;
                    return (
                      <li
                        key={n.file_name + n.folder}
                        style={{
                          background: isRead ? '#f7fafc' : '#ebf8ff',
                          borderRadius: 10,
                          padding: '4vw 3vw',
                          border: isRead ? '1px solid #e2e8f0' : '2px solid #3182ce',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 1px 6px rgba(44,62,80,0.08)',
                          fontSize: '4vw',
                          marginBottom: '2vw',
                          minHeight: 48,
                          transition: 'background 0.2s, border 0.2s',
                        }}
                      >
                        <div>
                          <strong>{n.file_name}</strong> in <em>{n.folder}</em><br />
                          <span style={{ fontSize: 13, color: '#666' }}>by {n.uploaded_by} at {new Date(n.uploaded_at).toLocaleString()}</span>
                        </div>
                        <span style={{
                          background: isRead ? '#38a169' : '#3182ce',
                          color: '#fff',
                          borderRadius: 12,
                          padding: '2px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          marginLeft: 10,
                          minWidth: 54,
                          textAlign: 'center',
                        }}>{isRead ? 'Read' : 'Unread'}</span>
                      </li>
                    );
                  })}
                </ul>
              </React.Fragment>
            ) : (
              // Global: group by project and folder
              (() => {
                const grouped: Record<string, Record<string, NotificationItem[]>> = {};
                notifications.forEach(n => {
                  if (!grouped[n.project_id]) grouped[n.project_id] = {};
                  if (!grouped[n.project_id][n.folder]) grouped[n.project_id][n.folder] = [];
                  grouped[n.project_id][n.folder].push(n);
                });
                return (
                  <div>
                    {Object.entries(grouped).map(([projectId, folders]) => (
                      <div key={projectId} style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, color: '#3182ce', fontSize: 15, marginBottom: 4 }}>Project: {projectNames[projectId] || projectId}</div>
                        {Object.entries(folders).map(([folder, items]) => (
                          <div key={folder} style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 600, color: '#2d3748', fontSize: 14, marginBottom: 2 }}>Folder: {folder}</div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                              {items.map(n => {
                                const isViewed = viewedMap[n.file_name] && viewedMap[n.file_name].includes(user.username);
                                const isDownloaded = downloadedMap[n.file_name] && downloadedMap[n.file_name].includes(user.username);
                                const isRead = isViewed || isDownloaded;
                                return (
                                  <li
                                    key={n.file_name + n.folder}
                                    style={{
                                      marginBottom: 8,
                                      background: isRead ? '#f7fafc' : '#ebf8ff',
                                      borderRadius: 6,
                                      padding: '8px 10px',
                                      border: isRead ? '1px solid #e2e8f0' : '1.5px solid #3182ce',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                    }}
                                  >
                                    <div>
                                      <strong>{n.file_name}</strong><br />
                                      <span style={{ fontSize: 13, color: '#666' }}>by {n.uploaded_by} at {new Date(n.uploaded_at).toLocaleString()}</span>
                                    </div>
                                    <span style={{
                                      background: isRead ? '#38a169' : '#3182ce',
                                      color: '#fff',
                                      borderRadius: 12,
                                      padding: '2px 10px',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      marginLeft: 10,
                                      minWidth: 54,
                                      textAlign: 'center',
                                    }}>{isRead ? 'Read' : 'Unread'}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()
            )
          )}
        </div>
      </div>
    </>
  );
};

export default Notifications;
