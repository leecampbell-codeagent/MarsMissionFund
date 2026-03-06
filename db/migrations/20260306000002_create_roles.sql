-- migrate:up
CREATE TABLE IF NOT EXISTS user_roles (
  id          UUID        NOT NULL,
  user_id     UUID        NOT NULL,
  role        TEXT        NOT NULL,
  assigned_by UUID        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role),
  CONSTRAINT user_roles_role_check CHECK (
    role IN ('backer', 'creator', 'reviewer', 'administrator', 'super_administrator')
  ),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by)
    REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON user_roles (assigned_by);

-- migrate:down
DROP TABLE IF EXISTS user_roles CASCADE;
