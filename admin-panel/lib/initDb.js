const pool = require('./db');

const CREATE_USERS_TABLE = `
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
    avatar_url VARCHAR(500) NULL,
    points INT NOT NULL DEFAULT 0,
    wins INT NOT NULL DEFAULT 0,
    matches INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_username (username),
    INDEX idx_users_mobile (mobile),
    INDEX idx_users_points (points)
  )
`;

const CREATE_WALLETS_TABLE = `
  CREATE TABLE IF NOT EXISTS wallets (
    user_id INT PRIMARY KEY,
    coin_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    deposit_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    winning_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    bonus_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const CREATE_WALLET_TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    gateway_order_id VARCHAR(50) NULL UNIQUE,
    transaction_type VARCHAR(20) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_wallet_transactions_user_date (user_id, created_at),
    CONSTRAINT fk_wallet_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB
`;

const CREATE_ZAPUPI_ORDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS zapupi_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL UNIQUE,
    provider_order_id VARCHAR(100) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    amount_paise BIGINT UNSIGNED NOT NULL,
    payment_url TEXT NOT NULL,
    status ENUM('PENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    KEY idx_zapupi_user_status (user_id, status),
    CONSTRAINT fk_zapupi_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB
`;

const CREATE_WALLET_DEPOSIT_REQUESTS_TABLE = `
  CREATE TABLE IF NOT EXISTS wallet_deposit_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    transaction_id VARCHAR(150) NOT NULL UNIQUE,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_deposit_requests_status_date (status, created_at),
    KEY idx_deposit_requests_user_date (user_id, created_at),
    CONSTRAINT fk_deposit_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB
`;

const CREATE_WALLET_WITHDRAW_REQUESTS_TABLE = `
  CREATE TABLE IF NOT EXISTS wallet_withdraw_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    upi_id VARCHAR(255) NOT NULL,
    status ENUM('pending', 'approved', 'cancelled') NOT NULL DEFAULT 'pending',
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_withdraw_requests_status_date (status, created_at),
    KEY idx_withdraw_requests_user_date (user_id, created_at),
    CONSTRAINT fk_withdraw_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB
`;

const CREATE_CONTACT_OPTIONS_TABLE = `
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
  ) ENGINE=InnoDB
`;

const CREATE_ANNOUNCEMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NULL,
    message TEXT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_announcements_active (is_active, created_at)
  )
`;

const CREATE_NOTIFICATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NULL,
    message TEXT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_notifications_active (is_active, created_at)
  )
`;

const CREATE_USER_PUSH_TOKENS_TABLE = `
  CREATE TABLE IF NOT EXISTS user_push_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'fcm',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_push_tokens_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB
`;

const CREATE_NOTIFICATION_READS_TABLE = `
  CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, user_id),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const CREATE_BANNERS_TABLE = `
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
  )
`;

const CREATE_GAMES_TABLE = `
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
  )
`;

const CREATE_MATCHES_TABLE = `
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
    completed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_matches_schedule (match_schedule),
    KEY idx_matches_status (status),
    KEY idx_matches_game (game_id),
    KEY idx_matches_game_status_completed (game_id, status, completed_at),
    KEY idx_matches_match_banner (match_banner_id),
    KEY idx_matches_rule (rule_id),
    CONSTRAINT fk_matches_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
    CONSTRAINT fk_matches_match_banner FOREIGN KEY (match_banner_id) REFERENCES match_banners(id) ON DELETE SET NULL,
    CONSTRAINT fk_matches_banner FOREIGN KEY (banner_id) REFERENCES banners(id) ON DELETE SET NULL
  ) ENGINE=InnoDB
`;

const CREATE_MATCH_PARTICIPANTS_TABLE = `
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
    KEY idx_participants_match (match_id),
    KEY idx_participants_user (user_id),
    CONSTRAINT fk_participants_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT fk_participants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB
`;

const CREATE_MATCH_RESULTS_TABLE = `
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
    KEY idx_results_match (match_id),
    CONSTRAINT fk_results_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT fk_results_winner FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_results_runner_up FOREIGN KEY (runner_up_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB
`;

const CREATE_APP_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`;

const CREATE_ADMIN_ACCOUNTS_TABLE = `
  CREATE TABLE IF NOT EXISTS admin_accounts (
    id TINYINT UNSIGNED PRIMARY KEY,
    username VARCHAR(40) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    session_version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_single_admin_account CHECK (id = 1)
  ) ENGINE=InnoDB
`;

const CREATE_ADMIN_VERIFICATION_TABLE = `
  CREATE TABLE IF NOT EXISTS admin_verification_codes (
    id TINYINT UNSIGNED PRIMARY KEY,
    purpose VARCHAR(20) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_single_admin_verification CHECK (id = 1)
  ) ENGINE=InnoDB
`;

const CREATE_STAFF_ACCOUNTS_TABLE = `
  CREATE TABLE IF NOT EXISTS staff_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(40) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    session_version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB
`;

const CREATE_RULES_TABLE = `
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
  )
`;

const CREATE_MATCH_BANNERS_TABLE = `
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
  )
`;

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  );

  if (rows[0].count === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function ensureIndex(table, index, columns) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [table, index],
  );
  if (rows[0].count === 0) {
    await pool.query(`ALTER TABLE ${table} ADD INDEX ${index} (${columns})`);
  }
}

async function ensureNullableColumn(table, column, definition) {
  await ensureColumn(table, column, definition);
  await pool.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} ${definition}`);
}

async function removeLegacyParticipantUniqueIndex() {
  const [indexes] = await pool.query(
    `SELECT COUNT(*) AS column_count,
        SUM(COLUMN_NAME = 'match_id') AS match_id_columns,
        SUM(COLUMN_NAME = 'user_id') AS user_id_columns,
        MAX(NON_UNIQUE) AS non_unique
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'match_participants'
       AND INDEX_NAME = 'uq_match_participant'`,
  );
  const index = indexes[0];
  if (Number(index.column_count) === 2
    && Number(index.match_id_columns) === 1
    && Number(index.user_id_columns) === 1
    && Number(index.non_unique) === 0) {
    const [matchIndexes] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'match_participants'
         AND COLUMN_NAME = 'match_id'
         AND SEQ_IN_INDEX = 1
         AND NON_UNIQUE = 1`,
    );
    if (Number(matchIndexes[0].count) === 0) {
      await pool.query('ALTER TABLE match_participants ADD INDEX idx_participants_match (match_id)');
    }
    await pool.query('ALTER TABLE match_participants DROP INDEX uq_match_participant');
  }
}

async function seedDefaults() {
  await pool.query(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
      ('support_email', 'support@battlenext.com'),
      ('support_phone', '+91 8000000000'),
      ('support_message', 'Our support team is available Monday to Saturday, 10 AM – 7 PM IST.')`,
  );

  const [announcements] = await pool.query('SELECT COUNT(*) AS count FROM announcements');
  if (announcements[0].count === 0) {
    await pool.query(
      `INSERT INTO announcements (title, message, is_active)
       VALUES (?, ?, 1)`,
      [
        'Welcome to BATTLE-NEXT',
        'Here is the latest announcement from BATTLE-NEXT esports tournaments. Stay tuned for upcoming events!',
      ],
    );
  }

  const [usersWithoutWallet] = await pool.query(
    `SELECT u.id FROM users u
     LEFT JOIN wallets w ON w.user_id = u.id
     WHERE w.user_id IS NULL`,
  );

  for (const user of usersWithoutWallet) {
    await pool.query('INSERT INTO wallets (user_id, coin_balance) VALUES (?, 0)', [user.id]);
  }
}

async function initDatabase() {
  await pool.query(CREATE_USERS_TABLE);
  await ensureColumn('users', 'points', 'INT NOT NULL DEFAULT 0');
  await ensureColumn('users', 'wins', 'INT NOT NULL DEFAULT 0');
  await ensureColumn('users', 'matches', 'INT NOT NULL DEFAULT 0');
  await ensureColumn('users', 'avatar_url', 'VARCHAR(500) NULL');
  await ensureColumn('users', 'is_blocked', 'TINYINT(1) NOT NULL DEFAULT 0');
  await pool.query(CREATE_WALLETS_TABLE);
  await pool.query('ALTER TABLE wallets MODIFY COLUMN coin_balance DECIMAL(12,2) NOT NULL DEFAULT 0');
  await ensureColumn('wallets', 'deposit_balance', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await ensureColumn('wallets', 'winning_balance', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await ensureColumn('wallets', 'bonus_balance', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE wallets MODIFY COLUMN deposit_balance DECIMAL(12,2) NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE wallets MODIFY COLUMN winning_balance DECIMAL(12,2) NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE wallets MODIFY COLUMN bonus_balance DECIMAL(12,2) NOT NULL DEFAULT 0');
  await pool.query(CREATE_WALLET_TRANSACTIONS_TABLE);
  await ensureColumn('wallet_transactions', 'gateway_order_id', 'VARCHAR(50) NULL UNIQUE');
  await pool.query(CREATE_ZAPUPI_ORDERS_TABLE);
  await pool.query(CREATE_WALLET_DEPOSIT_REQUESTS_TABLE);
  await pool.query(CREATE_WALLET_WITHDRAW_REQUESTS_TABLE);
  await pool.query(CREATE_CONTACT_OPTIONS_TABLE);
  await pool.query(CREATE_ANNOUNCEMENTS_TABLE);
  await pool.query(CREATE_NOTIFICATIONS_TABLE);
  await ensureColumn('notifications', 'link', 'VARCHAR(1000) NULL');
  await ensureColumn('notifications', 'icon_url', 'VARCHAR(1000) NULL');
  await pool.query(CREATE_NOTIFICATION_READS_TABLE);
  await pool.query(CREATE_USER_PUSH_TOKENS_TABLE);
  await ensureColumn('user_push_tokens', 'provider', "VARCHAR(20) NOT NULL DEFAULT 'fcm'");
  await pool.query(CREATE_BANNERS_TABLE);
  await ensureColumn('banners', 'key_name', 'VARCHAR(180) NULL');
  await ensureColumn('banners', 'title', 'VARCHAR(255) NULL');
  await ensureColumn('banners', 'image_url', 'VARCHAR(500) NOT NULL');
  await ensureColumn('banners', 'target_url', 'VARCHAR(1000) NULL');
  await ensureColumn('banners', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('banners', 'display_order', 'INT NOT NULL DEFAULT 0');
  await pool.query(CREATE_GAMES_TABLE);
  await ensureColumn('games', 'key_name', 'VARCHAR(180) NULL');
  await ensureColumn('games', 'title', 'VARCHAR(255) NULL');
  await ensureColumn('games', 'name', 'VARCHAR(150) NOT NULL');
  await ensureColumn('games', 'slug', 'VARCHAR(180) NULL');
  await ensureColumn('games', 'image_url', 'VARCHAR(500) NOT NULL');
  await ensureColumn('games', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('games', 'display_order', 'INT NOT NULL DEFAULT 0');
  await pool.query(CREATE_MATCH_BANNERS_TABLE);
  await ensureColumn('match_banners', 'match_slot', 'VARCHAR(100) NOT NULL DEFAULT "all"');
  await pool.query(CREATE_MATCHES_TABLE);
  await ensureColumn('matches', 'completed_at', 'DATETIME NULL');
  await ensureIndex('matches', 'idx_matches_game_status_completed', 'game_id, status, completed_at');
  await pool.query("UPDATE matches SET completed_at = updated_at WHERE status = 'Complete' AND completed_at IS NULL");
  await ensureColumn('matches', 'match_slot', 'VARCHAR(100) NOT NULL DEFAULT "all"');
  await ensureColumn('matches', 'game_version', 'VARCHAR(100) NOT NULL DEFAULT "Current"');
  await ensureColumn('matches', 'match_banner_id', 'INT NULL');
  await ensureColumn('matches', 'rule_id', 'INT NULL');
  await ensureNullableColumn('matches', 'game_id', 'INT NULL');
  await ensureColumn('matches', 'game_name', 'VARCHAR(150) NOT NULL DEFAULT "CS 1V1"');
  await ensureColumn('matches', 'event_name', 'VARCHAR(255) NOT NULL DEFAULT "CLASH SQUAD 1VS1"');
  await ensureColumn('matches', 'match_url', 'VARCHAR(500) NOT NULL DEFAULT "https://youtube.com/"');
  await ensureColumn('matches', 'match_schedule', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('matches', 'prize_pool', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await ensureColumn('matches', 'per_kill', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await ensureColumn('matches', 'team_type', 'VARCHAR(50) NOT NULL DEFAULT "SOLO"');
  await ensureColumn('matches', 'entry_fee', 'DECIMAL(10,2) NOT NULL DEFAULT 0');
  await ensureColumn('matches', 'total_players', 'INT NOT NULL DEFAULT 0');
  await ensureColumn('matches', 'map_name', 'VARCHAR(150) NOT NULL DEFAULT "Bermuda"');
  await ensureColumn('matches', 'banner_id', 'INT NULL');
  await ensureColumn('matches', 'room_description', 'TEXT NULL');
  await ensureColumn('matches', 'prize_description', 'TEXT NULL');
  await ensureColumn('matches', 'match_description', 'TEXT NULL');
  await ensureColumn('matches', 'private_description', 'TEXT NULL');
  await ensureColumn('matches', 'room_id', 'VARCHAR(150) NULL');
  await ensureColumn('matches', 'room_password', 'VARCHAR(150) NULL');
  await ensureColumn('matches', 'match_type', 'VARCHAR(50) NOT NULL DEFAULT "Paid"');
  await ensureColumn('matches', 'status', 'VARCHAR(30) NOT NULL DEFAULT "Upcoming"');
  await pool.query(CREATE_MATCH_PARTICIPANTS_TABLE);
  await removeLegacyParticipantUniqueIndex();
  await ensureColumn('match_participants', 'in_game_name', 'VARCHAR(150) NULL');
  await ensureColumn('match_participants', 'entry_fee', 'DECIMAL(10,2) NOT NULL DEFAULT 0');
  await ensureColumn('match_participants', 'result', 'VARCHAR(30) NULL');
  await ensureColumn('match_participants', 'kill_count', 'INT NOT NULL DEFAULT 0');
  await ensureColumn('match_participants', 'position', 'VARCHAR(30) NULL');
  await ensureColumn('match_participants', 'booyah_prize', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await ensureColumn('match_participants', 'total_prize', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await ensureColumn('match_participants', 'prize_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await pool.query(CREATE_MATCH_RESULTS_TABLE);
  await pool.query(CREATE_APP_SETTINGS_TABLE);
  await pool.query(CREATE_ADMIN_ACCOUNTS_TABLE);
  await pool.query(CREATE_ADMIN_VERIFICATION_TABLE);
  await pool.query(CREATE_STAFF_ACCOUNTS_TABLE);
  await pool.query(CREATE_RULES_TABLE);
  await ensureColumn('rules', 'match_slot', 'VARCHAR(100) NOT NULL DEFAULT "all"');
  await seedDefaults();
}

module.exports = { initDatabase };
