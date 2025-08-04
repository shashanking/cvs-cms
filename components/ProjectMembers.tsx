import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './UserContext';
import { useProject } from './ProjectContext';

interface MemberItem {
  id: string;
  username: string;
  role: string;
  joined_at: string;
}

export default function ProjectMembersComponent() {
  const { user } = useUser();
  const { project } = useProject();
  const projectId = project?.id;

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetchMembers();
  }, [projectId]);

  async function fetchMembers() {
    setLoading(true);
    const { data, error } = await supabase.from('project_members').select('*').eq('project_id', projectId).order('joined_at');
    if (error) setError(error.message);
    else setMembers(data || []);
    setLoading(false);
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) {
      setError('Enter a username');
      return;
    }

    setError(null);
    const tempMember: MemberItem = {
      id: 'temp-' + Math.random().toString(36).slice(2),
      username: inviteUsername.trim(),
      role: inviteRole,
      joined_at: new Date().toISOString(),
    };
    setMembers(m => [...m, tempMember]);
    setInviteUsername('');
    setInviteRole('member');
    setLoading(true);

    const { error } = await supabase.from('project_members').insert([
      { project_id: projectId, username: tempMember.username, role: tempMember.role }
    ]);
    setLoading(false);

    if (error) {
      setError(error.message);
      fetchMembers();
    } else {
      fetchMembers();
    }
  };

  const handleRemove = async (member: MemberItem) => {
    if (!window.confirm(`Remove ${member.username}?`)) return;

    setMembers(m => m.filter(mem => mem.username !== member.username));
    setError(null);
    setLoading(true);
    const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('username', member.username);
    setLoading(false);

    if (error) {
      setError(error.message);
      fetchMembers();
    } else {
      fetchMembers();
    }
  };

  if (!projectId) return <div>Loading members...</div>;

  return (
    <div>
      <h3>Project Members</h3>
      <form onSubmit={handleInvite} style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input
          value={inviteUsername}
          onChange={e => setInviteUsername(e.target.value)}
          placeholder="Username"
          required
          disabled={loading}
          style={{ minWidth: 140 }}
        />
        <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} disabled={loading}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
        <button type="submit" disabled={loading} style={{ cursor: loading ? 'not-allowed' : 'pointer' }}>
          Invite
        </button>
      </form>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {loading && members.length === 0 ? (
          <li>Loading...</li>
        ) : members.length === 0 ? (
          <li style={{ color: '#888' }}>No members yet.</li>
        ) : (
          members.map(member => (
            <li key={member.id} style={{ marginBottom: 10, padding: 10, borderRadius: 6, background: '#f7fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <span>
                <strong>{member.username}</strong> <span style={{ color: '#2563eb', fontWeight: 500, fontSize: 13 }}>({member.role})</span>
                <span style={{ color: '#888', fontSize: 12, marginLeft: 12 }}>{new Date(member.joined_at).toLocaleString()}</span>
              </span>
              {(user.role === 'owner' || user.role === 'admin') && user.username !== member.username && (
                <button onClick={() => handleRemove(member)} disabled={loading} style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer' }}>
                  Remove
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
