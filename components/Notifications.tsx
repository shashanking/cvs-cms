import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

// Notifications now uses context for user and project

interface NotificationItem {
  file_name: string;
  folder: string;
  uploaded_by: string;
  uploaded_at: string;
  project_id: string;
}

const Notifications = () => {
  const router = useRouter();
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [eventNotifications, setEventNotifications] = useState<any[]>([]); // event notifications
  const [chatMentions, setChatMentions] = useState<any[]>([]); // chat mention notifications
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewedMap, setViewedMap] = useState<Record<string, string[]>>({});
  const [downloadedMap, setDownloadedMap] = useState<Record<string, string[]>>({});
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});

  // Real-time subscription for chat mention notifications
  useEffect(() => {
    if (!user) return;
    let subscription: any;
    const fetchMentions = async () => {
      let query = supabase.from('chat_notifications').select('*').eq('mentioned_user', user.username).eq('read', false).order('created_at', { ascending: false });
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data } = await query;
      setChatMentions(data || []);
    };
    fetchMentions();
    if (projectId) {
      // Subscribe to only this project's notifications
      subscription = supabase
        .channel('public:chat_notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_notifications', filter: `project_id=eq.${projectId}` }, payload => {
          if (payload.new && payload.new.mentioned_user === user.username) {
            setChatMentions(prev => [payload.new, ...prev]);
          }
        })
        .subscribe();
    } else {
      // Subscribe to all projects' notifications
      subscription = supabase
        .channel('public:chat_notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_notifications' }, payload => {
          if (payload.new && payload.new.mentioned_user === user.username) {
            setChatMentions(prev => [payload.new, ...prev]);
          }
        })
        .subscribe();
    }
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, projectId]);

  // Mark chat mention as read
  const markChatMentionRead = async (id: string) => {
    await supabase.from('chat_notifications').update({ read: true }).eq('id', id);
    setChatMentions(prev => prev.filter(m => m.id !== id));
  };

  useEffect(() => {
    // Listen for mark-as-read events from ProjectEvents
    function handleEventNotificationRead(e: any) {
      if (e.detail && e.detail.eventId && e.detail.username && e.detail.projectId) {
        markEventNotificationRead(e.detail.eventId, e.detail.username, e.detail.projectId).then(() => fetchNotifications());
      }
    }
    function handleRefreshNotifications() {
      fetchNotifications();
    }
    window.addEventListener('eventNotificationRead', handleEventNotificationRead);
    window.addEventListener('refreshNotifications', handleRefreshNotifications);
    // Attach markEventNotificationRead to window for direct calls
    (window as any).markEventNotificationRead = async (eventId: number, username: string, projectId: string) => {
      await markEventNotificationRead(eventId, username, projectId);
      fetchNotifications();
    };
    return () => {
      window.removeEventListener('eventNotificationRead', handleEventNotificationRead);
      window.removeEventListener('refreshNotifications', handleRefreshNotifications);
      delete (window as any).markEventNotificationRead;
    };
  }, []);

  // Fetch all files uploaded by others that the user has not previewed
  const fetchNotifications = async () => {
    // Dashboard: all projects, Project page: only current project
    let uploads, previews, downloads, eventNotifs;
    if (!projectId || projectId === 'null' || projectId === 'undefined') {
      // All-projects notifications (dashboard)
      eventNotifs = (await supabase
        .from('event_notifications')
        .select('*')
        .eq('username', user.username)
        .order('created_at', { ascending: false })).data;
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
    } else {
      // Project-specific notifications
      eventNotifs = (await supabase
        .from('event_notifications')
        .select('*')
        .eq('project_id', projectId)
        .eq('username', user.username)
        .order('created_at', { ascending: false })).data;
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
    }
    setEventNotifications(eventNotifs || []);
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

    // Show all files uploaded by others (scoped here so uploads/previews/downloads/user are available)
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
    // Removed banner/toast notification logic for unread notifications. All notifications are now only shown in the sidebar/main notification UI.
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
        // Removed real-time banner/toast notification logic for new uploads. Notification will only appear in the sidebar/main notification UI.
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
          {/* Chat Mention Notifications */}
          {chatMentions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, color: '#e53e3e', fontSize: 15, marginBottom: 4 }}>Mentions in Chat</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {chatMentions.map(m => (
                  <li
                    key={m.id}
                    style={{ marginBottom: 8, background: '#fef2f2', borderRadius: 6, padding: '8px 10px', border: '1.5px solid #e53e3e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={async () => {
  setSidebarOpen(false);
  await markChatMentionRead(m.id);
  // Navigate to chat page and scroll to message if possible
  if (m.project_id && m.message_id) {
    router.push(`/project/${m.project_id}/chat?mid=${m.message_id}`);
  } else if (m.project_id) {
    router.push(`/project/${m.project_id}/chat`);
  }
}}
                    title="Go to chat message"
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#b91c1c', wordBreak: 'break-word', lineHeight: 1.4 }}>@{m.mentioned_user}</span> <span style={{ color: '#222' }}>mentioned by</span> <span style={{ fontWeight: 600, color: '#2563eb' }}>{m.mentioned_by}</span>
                      <div style={{ marginTop: 2, color: '#444', fontSize: 14 }}>{m.message}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                    <span style={{ background: '#e53e3e', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600, marginLeft: 10, minWidth: 54, textAlign: 'center' }}>Unread</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Event Notifications */}
          {eventNotifications.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, color: '#f59e42', fontSize: 15, marginBottom: 4 }}>Project Events</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {eventNotifications.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(ev => {
                  const isRead = !!ev.read;
                  return (
                    <li
                      key={ev.id}
                      style={{
                        marginBottom: 8,
                        background: isRead ? '#f7fafc' : '#fffbe6',
                        borderRadius: 6,
                        padding: '8px 10px',
                        border: isRead ? '1px solid #e2e8f0' : '2px solid #fbbf24',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        boxShadow: isRead ? 'none' : '0 2px 8px #fbbf2422',
                        transition: 'all 0.15s',
                        minHeight: 32,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
  setSidebarOpen(false);
  if (ev.project_id && ev.event_id) {
    router.push(`/project/${ev.project_id}?event=${ev.event_id}`);
  } else if (ev.project_id) {
    router.push(`/project/${ev.project_id}`);
  }
}}
                      title="Go to event details"
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, wordBreak: 'break-word', lineHeight: 1.4 }}>
                          Event: {ev.event_topic}
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          by {ev.created_by} at {new Date(ev.created_at).toLocaleString()}
                        </div>
                      </div>
                      <span style={{ background: isRead ? '#e2e8f0' : '#fbbf24', color: isRead ? '#888' : '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600, marginLeft: 10, minWidth: 54, textAlign: 'center' }}>{isRead ? 'Read' : 'Unread'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* File Upload Notifications */}
          {notifications.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, color: '#3182ce', fontSize: 15, marginBottom: 4 }}>File Uploads</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {notifications.map(n => (
                  <li
                    key={n.file_name + n.uploaded_at}
                    style={{ marginBottom: 8, background: '#f0f7ff', borderRadius: 6, padding: '8px 10px', border: '1.5px solid #3182ce', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => {
  setSidebarOpen(false);
  if (n.project_id && n.folder && n.file_name) {
    router.push(`/project/${n.project_id}?folder=${encodeURIComponent(n.folder)}&file=${encodeURIComponent(n.file_name)}`);
  } else if (n.project_id) {
    router.push(`/project/${n.project_id}`);
  }
}}
                    title="Go to file"
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#2563eb', wordBreak: 'break-word', lineHeight: 1.4 }}>{n.file_name}</span> <span style={{ color: '#222' }}>uploaded by</span> <span style={{ fontWeight: 600, color: '#3182ce' }}>{n.uploaded_by}</span>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{new Date(n.uploaded_at).toLocaleString()}</div>
                    </div>
                    <span style={{ background: '#3182ce', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600, marginLeft: 10, minWidth: 54, textAlign: 'center' }}>Unread</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No notifications fallback */}
          {(chatMentions.length === 0 && eventNotifications.length === 0 && notifications.length === 0) && (
            <div style={{ color: '#888' }}>No notifications</div>
          )}
        </div>
      </div>
    </>
  );
};

// Mark an event notification as read in the DB
async function markEventNotificationRead(eventId: number, username: string, projectId: string) {
  await supabase
    .from('event_notifications')
    .update({ read: true })
    .eq('event_id', eventId)
    .eq('username', username)
    .eq('project_id', projectId);
}

export default Notifications;
