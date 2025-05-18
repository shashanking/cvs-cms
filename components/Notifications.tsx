import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

type FileUploadAudit = {
  id: string;
  file_name: string;
  folder: string;
  uploaded_by: string;
  uploaded_at: string;
  project_id: string;
  action: 'upload' | 'preview' | 'download' | 'delete';
  viewed_by_users?: Array<{ username: string }>;
  downloaded_by_users?: Array<{ username: string }>;
};

type FileUploadAuditChange = {
  new: FileUploadAudit;
  old: FileUploadAudit;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
};

type FileUploadAuditPayload = RealtimePostgresChangesPayload<FileUploadAuditChange>;

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
      // Get event notifications, excluding those from soft-deleted events
      const { data: eventNotifsData } = await supabase
        .from('event_notifications')
        .select(`
          *,
          event:event_id (
            id,
            is_deleted
          )
        `)
        .eq('username', user.username)
        .order('created_at', { ascending: false });

      // Filter out notifications for soft-deleted events
      eventNotifs = (eventNotifsData || []).filter(
        (notification: any) => !notification.event || notification.event.is_deleted === false
      );
      // Get all uploads that haven't been soft-deleted
      const { data: allUploads } = await supabase
        .from('file_upload_audit')
        .select('file_name, folder, uploaded_by, uploaded_at, project_id, id, action')
        .eq('action', 'upload');

      // Get all deleted file names
      const { data: deletedFiles } = await supabase
        .from('file_upload_audit')
        .select('file_name')
        .eq('action', 'delete');

      // Create a Set of deleted file names for O(1) lookups
      const deletedFileNames = new Set(deletedFiles?.map(f => f.file_name) || []);

      // Filter out any upload where the file name appears in the deleted files
      const uploadsData = allUploads?.filter(upload => {
        const fileName = upload.file_name.split('/').pop(); // Extract just the file name
        return !deletedFileNames.has(fileName);
      }) || [];

      uploads = uploadsData || [];
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
      // Project-specific notifications, excluding soft-deleted events
      const { data: eventNotifsData } = await supabase
        .from('event_notifications')
        .select(`
          *,
          event:event_id (
            id,
            is_deleted
          )
        `)
        .eq('project_id', projectId)
        .eq('username', user.username)
        .order('created_at', { ascending: false });

      // Filter out notifications for soft-deleted events
      eventNotifs = (eventNotifsData || []).filter(
        (notification: any) => !notification.event || notification.event.is_deleted === false
      );
      // Get all uploads for the current project that haven't been soft-deleted
      const { data: allProjectUploads } = await supabase
        .from('file_upload_audit')
        .select('file_name, folder, uploaded_by, uploaded_at, project_id, id, action')
        .eq('project_id', projectId)
        .eq('action', 'upload');

      // Get all deleted file names for this project
      const { data: deletedProjectFiles } = await supabase
        .from('file_upload_audit')
        .select('file_name')
        .eq('project_id', projectId)
        .eq('action', 'delete');

      // Create a Set of deleted file names for O(1) lookups
      const deletedProjectFileNames = new Set(deletedProjectFiles?.map(f => f.file_name) || []);

      // Filter out any upload where the file name appears in the deleted files
      const uploadsData = allProjectUploads?.filter(upload => {
        const fileName = upload.file_name.split('/').pop(); // Extract just the file name
        return !deletedProjectFileNames.has(fileName);
      }) || [];

      uploads = uploadsData || [];
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

  // Memoize fetchNotifications to prevent unnecessary re-renders
  const memoizedFetchNotifications = React.useCallback(fetchNotifications, [projectId, user.username]);

  useEffect(() => {
    // Initial fetch
    memoizedFetchNotifications();

    // Listen for custom event to trigger notification refresh
    const handler = () => memoizedFetchNotifications();
    window.addEventListener('refresh-notifications', handler);

    // Set up real-time subscriptions
    const channels = [];
    let channel;

    // Subscribe to file upload/delete events
    channel = supabase
      .channel('file_upload_audit_notify')
      .on<FileUploadAuditPayload>('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'file_upload_audit',
        filter: projectId ? `project_id=eq.${projectId}` : undefined
      }, (payload) => {
        // Refresh notifications on upload or delete actions
        const change = payload as unknown as FileUploadAuditChange;
        if (change.new && (change.new.action === 'upload' || change.new.action === 'delete')) {
          memoizedFetchNotifications();
        }
      });
    channels.push(channel);

    // Subscribe to file preview events
    channel = supabase
      .channel('file_upload_audit_preview_notify')
      .on<FileUploadAuditPayload>('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'file_upload_audit',
        filter: `action=eq.preview${projectId ? `&project_id=eq.${projectId}` : ''}`
      }, () => {
        memoizedFetchNotifications();
      });
    channels.push(channel);

    // Subscribe to file download events
    channel = supabase
      .channel('file_upload_audit_download_notify')
      .on<FileUploadAuditPayload>('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'file_upload_audit',
        filter: `action=eq.download${projectId ? `&project_id=eq.${projectId}` : ''}`
      }, () => {
        memoizedFetchNotifications();
      });
    channels.push(channel);

    // Subscribe to file deletion events specifically
    channel = supabase
      .channel('file_upload_audit_delete_notify')
      .on<FileUploadAuditPayload>('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'file_upload_audit',
        filter: `action=eq.delete${projectId ? `&project_id=eq.${projectId}` : ''}`
      }, () => {
        // Force immediate refresh when a file is deleted
        memoizedFetchNotifications();
      });
    channels.push(channel);

    // Subscribe to event notifications
    channel = supabase
      .channel('event_notifications_notify')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_notifications',
        filter: projectId ? `project_id=eq.${projectId}` : undefined
      }, (payload: { new: { username?: string } }) => {
        if (payload.new?.username && payload.new.username === user.username) {
          memoizedFetchNotifications();
        }
      });
    channels.push(channel);

    // Subscribe to chat notifications
    channel = supabase
      .channel('chat_notifications_notify')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_notifications',
        filter: projectId ? `project_id=eq.${projectId}` : undefined
      }, (payload: { new: { mentioned_user?: string } }) => {
        if (payload.new?.mentioned_user && payload.new.mentioned_user === user.username) {
          memoizedFetchNotifications();
        }
      });
    channels.push(channel);

    // Subscribe to project events changes
    channel = supabase
      .channel('project_events_notify')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_events',
        filter: projectId ? `project_id=eq.${projectId}` : undefined
      }, () => {
        memoizedFetchNotifications();
      });
    channels.push(channel);

    // Subscribe to project tasks changes
    channel = supabase
      .channel('project_tasks_notify')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_tasks',
        filter: projectId ? `project_id=eq.${projectId}` : undefined
      }, () => {
        memoizedFetchNotifications();
      });
    channels.push(channel);

    // Subscribe to all channels
    channels.forEach(c => c.subscribe());

    // Cleanup function
    return () => {
      channels.forEach(c => {
        try {
          supabase.removeChannel(c);
        } catch (e) {
          console.error('Error removing channel:', e);
        }
      });
      window.removeEventListener('refresh-notifications', handler);
    };
  }, [projectId, user.username, memoizedFetchNotifications]);

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
          const isViewed = viewedMap[n.file_name]?.includes(user.username);
          const isDownloaded = downloadedMap[n.file_name]?.includes(user.username);
          return !(isViewed || isDownloaded);
        }).length + eventNotifications.filter(ev => {
          const isRead = !!ev.read;
          const eventDate = new Date(ev.event_datetime || ev.created_at);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return !isRead && eventDate >= today;
        }).length + chatMentions.length) > 0 && (
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
              const isViewed = viewedMap[n.file_name]?.includes(user.username);
              const isDownloaded = downloadedMap[n.file_name]?.includes(user.username);
              return !(isViewed || isDownloaded);
            }).length + eventNotifications.filter(ev => {
              const isRead = !!ev.read;
              const eventDate = new Date(ev.event_datetime || ev.created_at);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return !isRead && eventDate >= today;
            }).length + chatMentions.length}</span>
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
          {eventNotifications.filter(ev => {
            try {
              // First try to get the event date from the event itself if it's populated
              const eventDate = ev.event?.datetime ? new Date(ev.event.datetime) : 
                               ev.event_datetime ? new Date(ev.event_datetime) : 
                               new Date(ev.created_at);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return eventDate >= today;
            } catch (e) {
              console.error('Error processing event date:', e, ev);
              return false; // Skip events with invalid dates
            }
          }).length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 700, color: '#f59e42', fontSize: 15, marginBottom: 4 }}>Project Events</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {eventNotifications
                    .filter(ev => {
                      try {
                        // First try to get the event date from the event itself if it's populated
                        const eventDate = ev.event?.datetime ? new Date(ev.event.datetime) : 
                                         ev.event_datetime ? new Date(ev.event_datetime) : 
                                         new Date(ev.created_at);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return eventDate >= today;
                      } catch (e) {
                        console.error('Error processing event date:', e, ev);
                        return false; // Skip events with invalid dates
                      }
                    })
                    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
                    .map(ev => {
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
                          <span style={{
                            background: isRead ? '#e2e8f0' : '#fbbf24',
                            color: isRead ? '#888' : '#fff',
                            borderRadius: 12,
                            padding: '2px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            marginLeft: 10,
                            minWidth: 54,
                            textAlign: 'center'
                          }}>
                            {isRead ? 'Read' : 'Unread'}
                          </span>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#2563eb', wordBreak: 'break-word', lineHeight: 1.4 }}>
                          {n.file_name}
                        </span>
                        {n.folder && (
                          <div style={{ fontSize: 11, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: '#6b7280' }}>Folder:</span>
                            <span style={{ fontWeight: 500, color: '#4f46e5' }}>{n.folder}</span>
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>Uploaded by</span>
                          <span style={{ fontWeight: 600, color: '#3182ce' }}>{n.uploaded_by}</span>
                          <span>•</span>
                          <span>{new Date(n.uploaded_at).toLocaleString()}</span>
                        </div>
                      </div>
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
