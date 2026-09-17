CREATE DATABASE IF NOT EXISTS myapp_db;
USE myapp_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  mobile VARCHAR(30) NOT NULL,
  country_code VARCHAR(10) NOT NULL DEFAULT '+91',
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  referral_code VARCHAR(100) NULL,
  is_blocked TINYINT(1) NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  matches INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_username (username),
  INDEX idx_users_mobile (mobile)
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id INT PRIMARY KEY,
  coin_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  deposit_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  winning_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonus_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wallet_transactions_user_date (user_id, created_at),
  CONSTRAINT fk_wallet_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallet_deposit_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  transaction_id VARCHAR(150) NOT NULL UNIQUE,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deposit_requests_status_date (status, created_at),
  INDEX idx_deposit_requests_user_date (user_id, created_at),
  CONSTRAINT fk_deposit_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallet_withdraw_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  upi_id VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'cancelled') NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_withdraw_requests_status_date (status, created_at),
  INDEX idx_withdraw_requests_user_date (user_id, created_at),
  CONSTRAINT fk_withdraw_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_type VARCHAR(20) NOT NULL,
  label VARCHAR(100) NOT NULL,
  contact_value VARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contact_options_active_order (is_active, display_order)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NULL,
  message TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_announcements_active (is_active, created_at)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NULL,
  message TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_notifications_active (is_active, created_at)
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INT NOT NULL,
  user_id INT NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  target_url VARCHAR(1000) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_banners_active_order (is_active, display_order, created_at)
);

CREATE TABLE IF NOT EXISTS games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  image_url VARCHAR(500) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_games_active_order (is_active, display_order, created_at)
);

CREATE TABLE IF NOT EXISTS rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  match_slot VARCHAR(100) NOT NULL DEFAULT 'all',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rules_active_order (is_active, display_order, created_at)
);

CREATE TABLE IF NOT EXISTS match_banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  match_slot VARCHAR(100) NOT NULL DEFAULT 'all',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_match_banners_active_order (is_active, display_order, created_at)
);

CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL UNIQUE,
  match_slot VARCHAR(100) NOT NULL DEFAULT 'all',
  game_id INT NULL,
  game_name VARCHAR(150) NOT NULL,
  game_version VARCHAR(100) NOT NULL DEFAULT 'Current',
  event_name VARCHAR(255) NOT NULL,
  match_url VARCHAR(500) NOT NULL,
  match_schedule DATETIME NOT NULL,
  prize_pool DECIMAL(12,2) NOT NULL DEFAULT 0,
  per_kill DECIMAL(12,2) NOT NULL DEFAULT 0,
  team_type VARCHAR(50) NOT NULL DEFAULT 'SOLO',
  entry_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_players INT NOT NULL DEFAULT 0,
  map_name VARCHAR(150) NOT NULL,
  match_banner_id INT NULL,
  rule_id INT NULL,
  banner_id INT NULL,
  room_description TEXT NULL,
  prize_description TEXT NULL,
  match_description TEXT NULL,
  private_description TEXT NULL,
  room_id VARCHAR(150) NULL,
  room_password VARCHAR(150) NULL,
  match_type VARCHAR(50) NOT NULL DEFAULT 'Paid',
  status VARCHAR(30) NOT NULL DEFAULT 'Upcoming',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_matches_schedule (match_schedule),
  INDEX idx_matches_status (status),
  INDEX idx_matches_game (game_id),
  INDEX idx_matches_match_banner (match_banner_id),
  INDEX idx_matches_rule (rule_id),
  CONSTRAINT fk_matches_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
  CONSTRAINT fk_matches_match_banner FOREIGN KEY (match_banner_id) REFERENCES match_banners(id) ON DELETE SET NULL,
  CONSTRAINT fk_matches_banner FOREIGN KEY (banner_id) REFERENCES banners(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  user_id INT NULL,
  username VARCHAR(150) NULL,
  name VARCHAR(150) NULL,
  in_game_name VARCHAR(150) NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  entry_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Joined',
  result VARCHAR(30) NULL,
  kill_count INT NOT NULL DEFAULT 0,
  position VARCHAR(30) NULL,
  booyah_prize DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_prize DECIMAL(12,2) NOT NULL DEFAULT 0,
  prize_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_participants_match (match_id),
  INDEX idx_participants_user (user_id),
  CONSTRAINT fk_participants_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_participants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  winner_user_id INT NULL,
  runner_up_user_id INT NULL,
  winner_name VARCHAR(150) NULL,
  runner_up_name VARCHAR(150) NULL,
  other_positions JSON NULL,
  kill_count INT NOT NULL DEFAULT 0,
  prize_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_results_match (match_id),
  CONSTRAINT fk_results_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_results_winner FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_results_runner_up FOREIGN KEY (runner_up_user_id) REFERENCES users(id) ON DELETE SET NULL
);
