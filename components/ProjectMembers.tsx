import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

interface ProjectMembersProps {
}

interface MemberItem {
  id: string;
  username: string;
  role: string;
  joined_at: string;
}

function ProjectMembersComponent() {
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  useEffect(() => {
    if (!projectId) return;
    fetchMembers();
  }, [projectId]);

  const fetchMembers = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true });
    if (error) setError(error.message);
    setMembers(data || []);
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Project not loaded yet.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.from('project_members').insert([
      {
        project_id: projectId,
        username: inviteUsername,
        role: inviteRole,
      },
    ]);
    if (error) setError(error.message);
    setInviteUsername('');
    setInviteRole('member');
    fetchMembers();
    setLoading(false);
  };

  const handleRemove = async (member: MemberItem) => {
    if (!window.confirm(`Remove ${member.username} from project?`)) return;
    if (!projectId) {
      setError('Project not loaded yet.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('username', member.username);
    if (error) setError(error.message);
    fetchMembers();
    setLoading(false);
  };

  if (!projectId) return <div>Loading project members...</div>;
  return (
    <div style={{ margin: '24px 0' }}>
      <h3>Project Members</h3>
      <form onSubmit={handleInvite} style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input value={inviteUsername} onChange={e => setInviteUsername(e.target.value)} placeholder="Username to invite" required style={{ minWidth: 140 }} />
        <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
        <button type="submit" disabled={loading}>Invite</button>
      </form>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {loading ? <li>Loading...</li> : members.length === 0 ? (
          <li style={{ color: '#888' }}>No members yet.</li>
        ) : (
          members.map(member => (
            <li key={member.username} style={{ marginBottom: 10, background: '#f7fafc', borderRadius: 6, padding: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                <span style={{ fontWeight: 600 }}>{member.username}</span>
                <span style={{ color: '#2563eb', fontWeight: 500, marginLeft: 8, fontSize: 13 }}>({member.role})</span>
                <span style={{ marginLeft: 12, color: '#888', fontSize: 12 }}>{new Date(member.joined_at).toLocaleString()}</span>
              </span>
              {user.role === 'owner' || user.role === 'admin' ? (
                <button onClick={() => handleRemove(member)} disabled={loading} style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Remove</button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default ProjectMembersComponent;
