CREATE TABLE IF NOT EXISTS app_users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  issuer VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  subject VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  syfo_server_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email VARCHAR(320) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  email_verified BOOLEAN NULL,
  display_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  avatar_url TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY app_users_issuer_subject_unique (issuer, subject),
  KEY app_users_server_id_index (syfo_server_id)
);

CREATE TABLE IF NOT EXISTS app_user_preferences (
  app_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  preferences JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (app_user_id)
);
