-- Project Table Example (with audit fields)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz
);

-- Example for another entity (e.g., proposals)
create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  title text not null,
  content text,
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz
);

-- Table for project tasks
create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  title text not null,
  description text,
  assignee text not null,
  status text default 'open',
  created_by text not null,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz
);

-- Table for comments on tasks
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references project_tasks(id),
  username text not null,
  comment text not null,
  created_at timestamptz default now()
);

-- Table for time tracking on tasks
create table if not exists task_time_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references project_tasks(id),
  username text not null,
  time_spent_minutes integer not null,
  description text,
  created_at timestamptz default now()
);
