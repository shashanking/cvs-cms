// Reusable helpers for audit tracking on create/update
export interface AuditFields {
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

export function getCreateAudit(user: { username: string } | null): AuditFields {
  return {
    created_by: user?.username || 'unknown',
    created_at: new Date().toISOString(),
  };
}

export function getUpdateAudit(user: { username: string } | null): AuditFields {
  return {
    updated_by: user?.username || 'unknown',
    updated_at: new Date().toISOString(),
  };
}
