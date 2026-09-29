const express = require('express');
const pool = require('../lib/db');

const router = express.Router();

function mapMatch(row, participants = []) {
  return {
    id: row.id,
    matchId: row.match_id,
    gameId: row.game_id,
    gameName: row.game_name,
    gameVersion: row.game_version,
    name: `${row.event_name} #${row.match_id}`,
    matchUrl: row.match_url,
    matchSchedule: row.match_schedule_utc || row.match_schedule,
    createdAt: row.created_at,
    prizePool: Number(row.prize_pool ?? 0),
    perKill: Number(row.per_kill ?? 0),
    teamType: row.team_type,
    entryFee: Number(row.entry_fee ?? 0),
    totalPlayers: Number(row.total_players ?? 0),
    joinedPlayers: Number(row.joined_players ?? 0),
    userEntryCount: Number(row.user_entry_count ?? 0),
    map: row.map_name,
    status: row.status,
    bannerTitle: row.banner_title,
    bannerUrl: row.banner_url,
    ruleTitle: row.rule_title,
    ruleContent: row.rule_content,
    prizeDescription: row.prize_description,
    matchDescription: row.match_description,
    roomId: row.room_id || null,
    roomPassword: row.room_password || null,
    participants,
  };
}

router.get('/active', async (req, res) => {
  const gameId = Number(req.query.gameId);
  if (!Number.isInteger(gameId) || gameId <= 0) {
    return res.status(400).json({ error: 'A valid gameId is required' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.match_id, m.game_id, g.name AS game_name, m.game_version, m.event_name,
        DATE_FORMAT(m.match_schedule, '%Y-%m-%dT%H:%i:%sZ') AS match_schedule_utc,
        m.prize_pool, m.per_kill, m.team_type, m.entry_fee, m.total_players,
        m.map_name, m.status, m.match_banner_id, mb.title AS banner_title, mb.image_url AS banner_url,
        COUNT(mp.id) AS joined_players
      FROM matches m
      LEFT JOIN games g ON g.id = m.game_id
       LEFT JOIN match_banners mb ON mb.id = m.match_banner_id
       LEFT JOIN match_participants mp ON mp.match_id = m.id
       WHERE m.game_id = ? AND m.status IN ('Upcoming', 'Ongoing')
       GROUP BY m.id, mb.id
       ORDER BY m.match_schedule ASC, m.created_at DESC`,
      [gameId],
    );

    res.json({
      matches: rows.map((row) => mapMatch(row)),
    });
  } catch (error) {
    console.error('GET /api/matches/active failed:', error);
    res.status(500).json({ error: 'Failed to fetch active matches' });
  }
});

router.get('/by-status', async (req, res) => {
  const gameId = Number(req.query.gameId);
  const userId = Number(req.query.userId) || 0;
  const requestedStatus = String(req.query.status || '').toLowerCase();
  const status = { upcoming: 'Upcoming', ongoing: 'Ongoing', complete: 'Complete' }[requestedStatus];
  if (!Number.isInteger(gameId) || gameId <= 0) return res.status(400).json({ error: 'A valid gameId is required' });
  if (!status) return res.status(400).json({ error: 'A valid match status is required' });

  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.match_id, m.game_id, g.name AS game_name, m.game_version, m.event_name,
        DATE_FORMAT(m.match_schedule, '%Y-%m-%dT%H:%i:%sZ') AS match_schedule_utc,
        m.prize_pool, m.per_kill, m.team_type, m.entry_fee, m.total_players,
        m.map_name, m.status, m.match_banner_id, mb.title AS banner_title, mb.image_url AS banner_url,
        COUNT(mp.id) AS joined_players,
        (SELECT COUNT(*) FROM match_participants user_mp WHERE user_mp.match_id = m.id AND user_mp.user_id = ?) AS user_entry_count
       FROM matches m
       LEFT JOIN games g ON g.id = m.game_id
       LEFT JOIN match_banners mb ON mb.id = m.match_banner_id
       LEFT JOIN match_participants mp ON mp.match_id = m.id
       WHERE m.game_id = ? AND m.status = ?
       GROUP BY m.id, mb.id
       ORDER BY m.match_schedule ASC, m.created_at DESC`,
      [userId, gameId, status],
    );
    res.json({ matches: rows.map((row) => mapMatch(row)) });
  } catch (error) {
    console.error('GET /api/matches/by-status failed:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const userId = Number(req.query.userId);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid match id' });

  try {
    const [rows] = await pool.query(
      `SELECT m.*, DATE_FORMAT(m.match_schedule, '%Y-%m-%dT%H:%i:%sZ') AS match_schedule_utc,
        g.name AS game_name, mb.title AS banner_title, mb.image_url AS banner_url,
        r.title AS rule_title, r.content AS rule_content,
        (SELECT COUNT(*) FROM match_participants mp WHERE mp.match_id = m.id) AS joined_players
       FROM matches m
       LEFT JOIN games g ON g.id = m.game_id
       LEFT JOIN match_banners mb ON mb.id = m.match_banner_id
       LEFT JOIN rules r ON r.id = m.rule_id
      WHERE m.id = ? AND m.status IN ('Upcoming', 'Ongoing', 'Complete')
      `,
      [id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Match not found' });

    const [participants] = await pool.query(
          `SELECT mp.id, mp.user_id, u.username,
            CONCAT(u.first_name, ' ', u.last_name) AS name,
            mp.in_game_name, mp.kill_count, mp.position,
            mp.booyah_prize, mp.total_prize, mp.prize_amount, mp.result,
            mp.status, mp.joined_at
           FROM match_participants mp
           LEFT JOIN users u ON u.id = mp.user_id
           WHERE mp.match_id = ?
           ORDER BY mp.position IS NULL, mp.position ASC, mp.joined_at ASC`,
      [id],
    );
    const isJoined = Number.isInteger(userId) && userId > 0 && participants.some((participant) => participant.user_id === userId);
    const match = mapMatch(rows[0], participants.map((participant) => ({
      id: participant.id,
      userId: participant.user_id,
      username: participant.username,
      name: participant.name,
      inGameName: participant.in_game_name,
      kills: Number(participant.kill_count ?? 0),
      position: participant.position,
      booyahPrize: Number(participant.booyah_prize ?? 0),
      totalPrize: Number(participant.total_prize ?? 0),
      prizeAmount: Number(participant.prize_amount ?? 0),
      result: participant.result,
      status: participant.status,
      joinedAt: participant.joined_at,
    })));
    if (!isJoined) {
      match.roomId = null;
      match.roomPassword = null;
    }
    res.json({ match, isJoined });
  } catch (error) {
    console.error('GET /api/matches/:id failed:', error);
    res.status(500).json({ error: 'Failed to fetch match details' });
  }
});

router.patch('/:id/entry', async (req, res) => {
  const matchId = Number(req.params.id);
  const userId = Number(req.body.userId);
  const inGameName = String(req.body.inGameName || '').trim();

  if (!Number.isInteger(matchId) || matchId <= 0) return res.status(400).json({ error: 'Invalid match id' });
  if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ error: 'Please log in to edit this entry.' });
  if (!inGameName || inGameName.length > 150) return res.status(400).json({ error: 'Enter a game name between 1 and 150 characters.' });

  try {
    const [matches] = await pool.query('SELECT status FROM matches WHERE id = ?', [matchId]);
    if (!matches[0]) return res.status(404).json({ error: 'Match not found.' });
    if (matches[0].status !== 'Upcoming') return res.status(409).json({ error: 'Entries can only be edited before the match starts.' });

    const [entries] = await pool.query(
      'SELECT id FROM match_participants WHERE match_id = ? AND user_id = ? LIMIT 1',
      [matchId, userId],
    );
    if (!entries[0]) return res.status(404).json({ error: 'You have not joined this match.' });

    await pool.query(
      'UPDATE match_participants SET in_game_name = ? WHERE match_id = ? AND user_id = ?',
      [inGameName, matchId, userId],
    );
    res.json({ message: 'Entry updated.', inGameName });
  } catch (error) {
    console.error('PATCH /api/matches/:id/entry failed:', error);
    res.status(500).json({ error: 'Failed to update match entry.' });
  }
});

router.post('/:id/join', async (req, res) => {
  const matchId = Number(req.params.id);
  const userId = Number(req.body.userId);
  const inGameName = String(req.body.inGameName || '').trim();

  if (!Number.isInteger(matchId) || matchId <= 0) return res.status(400).json({ error: 'Invalid match id' });
  if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ error: 'Please log in to join this match.' });
  if (!inGameName) return res.status(400).json({ error: 'In-game name is required.' });
  if (inGameName.length > 150) return res.status(400).json({ error: 'In-game name must be 150 characters or fewer.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [matches] = await connection.query(
      'SELECT id, entry_fee, total_players, status FROM matches WHERE id = ? AND status IN (\'Upcoming\', \'Ongoing\') FOR UPDATE',
      [matchId],
    );
    if (!matches[0]) {
      await connection.rollback();
      return res.status(404).json({ error: 'Match not found' });
    }

    const [existing] = await connection.query(
      'SELECT COUNT(*) AS entry_count FROM match_participants WHERE match_id = ? AND user_id = ?',
      [matchId, userId],
    );
    if (Number(existing[0].entry_count) >= 2) {
      await connection.rollback();
      return res.status(409).json({ error: 'You have already joined this match with the maximum number of entries.' });
    }

    const [countRows] = await connection.query(
      'SELECT COUNT(*) AS joined_players FROM match_participants WHERE match_id = ?',
      [matchId],
    );
    if (Number(countRows[0].joined_players) >= Number(matches[0].total_players)) {
      await connection.rollback();
      return res.status(409).json({ error: 'This match is full.' });
    }

    const [users] = await connection.query('SELECT username, first_name, last_name, is_blocked FROM users WHERE id = ?', [userId]);
    if (!users[0]) {
      await connection.rollback();
      return res.status(401).json({ error: 'User account not found.' });
    }
    if (users[0].is_blocked) {
      await connection.rollback();
      return res.status(403).json({ error: 'Your account has been blocked by the administrator.' });
    }
    const [walletRows] = await connection.query(
      'SELECT coin_balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId],
    );
    const balance = Number(walletRows[0]?.coin_balance ?? 0);
    const entryFee = Number(matches[0].entry_fee ?? 0);
    if (balance < entryFee) {
      await connection.rollback();
      return res.status(400).json({ error: `Insufficient wallet balance. You need ${entryFee} coins.` });
    }
    await connection.query(
      'INSERT INTO match_participants (match_id, user_id, in_game_name, entry_fee, status, result) VALUES (?, ?, ?, ?, ?, ?)',
      [matchId, userId, inGameName, entryFee, 'Joined', 'Joined'],
    );
    if (entryFee > 0) {
      await connection.query(
        'UPDATE wallets SET coin_balance = coin_balance - ?, deposit_balance = GREATEST(deposit_balance - ?, 0) WHERE user_id = ?',
        [entryFee, entryFee, userId],
      );
      await connection.query(
        `INSERT INTO wallet_transactions (user_id, transaction_type, amount, description)
         VALUES (?, 'withdraw', ?, ?)`,
        [userId, entryFee, `Entry fee for match #${matchId}`],
      );
    }
    await connection.commit();
    res.status(201).json({ message: 'You joined the match successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('POST /api/matches/:id/join failed:', error);
    res.status(500).json({ error: 'Failed to join match' });
  } finally {
    connection.release();
  }
});

module.exports = router;
