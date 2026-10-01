const express = require('express');
const pool = require('../lib/db');
const { requireMatchAccess } = require('../lib/adminAuth');
const { sendPushNotification } = require('../lib/firebasePush');

const router = express.Router();

const STATUS_OPTIONS = ['Upcoming', 'Ongoing', 'Complete', 'Cancelled'];
const ALLOWED_STATUS_TRANSITIONS = {
  Upcoming: ['Ongoing', 'Cancelled'],
  Ongoing: ['Complete', 'Cancelled'],
  Complete: [],
  Cancelled: [],
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeStatus(value) {
  const next = cleanText(value, 'Upcoming');
  return STATUS_OPTIONS.includes(next) ? next : 'Upcoming';
}

function normalizeMatchType(value) {
  const next = cleanText(value, 'Paid');
  return next || 'Paid';
}

function ensureMoney(value) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Number(parsed.toFixed(2));
}

function mapParticipant(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    name: row.name,
    inGameName: row.in_game_name || row.username || row.name,
    joinedAt: row.joined_at,
    entryFee: Number(row.entry_fee ?? 0),
    status: row.status,
    result: row.result,
    kills: Number(row.kill_count ?? 0),
    position: row.position,
    booyahPrize: Number(row.booyah_prize ?? 0),
    totalPrize: Number(row.total_prize ?? row.prize_amount ?? 0),
    prizeAmount: Number(row.prize_amount ?? 0),
  };
}

function mapResult(row) {
  if (!row) return null;
  return {
    id: row.id,
    winnerUserId: row.winner_user_id,
    runnerUpUserId: row.runner_up_user_id,
    winnerName: row.winner_name,
    runnerUpName: row.runner_up_name,
    otherPositions: row.other_positions || [],
    killCount: row.kill_count,
    prizeAmount: Number(row.prize_amount ?? 0),
    createdAt: row.created_at,
  };
}

function mapMatch(row) {
  return {
    id: row.id,
    matchId: row.match_id,
    matchSlot: row.match_slot,
    gameId: row.game_id,
    gameName: row.game_name || row.game_name_fallback || 'Unknown',
    gameVersion: row.game_version,
    eventName: row.event_name,
    matchUrl: row.match_url,
    matchSchedule: row.match_schedule_utc || row.match_schedule,
    prizePool: Number(row.prize_pool ?? 0),
    perKill: Number(row.per_kill ?? 0),
    teamType: row.team_type,
    entryFee: Number(row.entry_fee ?? 0),
    totalPlayers: Number(row.total_players ?? 0),
    joinedPlayers: Number(row.joined_players ?? 0),
    map: row.map_name,
    bannerId: row.banner_id,
    matchBannerId: row.match_banner_id,
    ruleId: row.rule_id,
    bannerUrl: row.banner_url,
    roomDescription: row.room_description,
    prizeDescription: row.prize_description,
    matchDescription: row.match_description,
    privateDescription: row.private_description,
    roomId: row.room_id,
    roomPassword: row.room_password,
    matchType: row.match_type || 'Paid',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const baseMatchSelect = `
  SELECT
    m.id,
    m.match_id,
    m.match_slot,
    m.game_id,
    COALESCE(g.name, m.game_name) AS game_name,
    m.game_name AS game_name_fallback,
    m.game_version,
    m.event_name,
    m.match_url,
    DATE_FORMAT(m.match_schedule, '%Y-%m-%dT%H:%i:%sZ') AS match_schedule_utc,
    m.prize_pool,
    m.per_kill,
    m.team_type,
    m.entry_fee,
    m.total_players,
    m.map_name,
    m.banner_id,
    m.match_banner_id,
    m.rule_id,
    mb.image_url AS banner_url,
    m.room_description,
    m.prize_description,
    m.match_description,
    m.private_description,
    m.room_id,
    m.room_password,
    m.match_type,
    m.status,
    m.created_at,
    m.updated_at,
    COUNT(mp.id) AS joined_players
  FROM matches m
  LEFT JOIN games g ON g.id = m.game_id
  LEFT JOIN banners b ON b.id = m.banner_id
  LEFT JOIN match_banners mb ON mb.id = m.match_banner_id
  LEFT JOIN match_participants mp ON mp.match_id = m.id
`;

function validateMatchPayload(body) {
  const roomDescription = cleanText(body.roomDescription || body.room_description);
  const gameName = cleanText(body.gameName || body.game_name);
  const matchSlot = cleanText(body.matchSlot || body.match_slot, 'all');
  const gameVersion = cleanText(body.gameVersion || body.game_version, 'Current');
  const eventName = cleanText(body.eventName || body.event_name);
  const matchUrl = cleanText(body.matchUrl || body.match_url);
  const matchSchedule = cleanText(body.matchSchedule || body.match_schedule);
  const prizePool = ensureMoney(body.prizePool);
  const perKill = ensureMoney(body.perKill);
  const teamType = cleanText(body.teamType || body.team_type, 'SOLO');
  const entryFee = ensureMoney(body.entryFee);
  const totalPlayers = toNumber(body.totalPlayers, 0);
  const mapName = cleanText(body.map || body.map_name);
  const gameId = Number(body.gameId || body.game_id || 0) || null;
  const ruleId = Number(body.ruleId || body.rule_id || 0) || null;

  const errors = [];

  if (!gameName) errors.push('Game is required.');
  if (!eventName) errors.push('Match/event name is required.');
  if (!matchUrl) errors.push('Match URL is required.');
  if (!matchSchedule) errors.push('Match schedule is required.');
  if (prizePool <= 0) errors.push('Prize pool must be greater than 0.');
  if (perKill < 0) errors.push('Per kill must be 0 or greater.');
  if (!teamType) errors.push('Team type is required.');
  if (entryFee < 0) errors.push('Entry fee must be 0 or greater.');
  if (!Number.isInteger(totalPlayers) || totalPlayers <= 0) errors.push('Total players must be a positive integer.');
  if (!mapName) errors.push('Map is required.');
  if (!gameId) errors.push('Games Slot is required.');
  if (!ruleId) errors.push('Rules are required.');

  return {
    valid: errors.length === 0,
    errors,
    roomDescription,
    gameName,
    matchSlot,
    gameVersion,
    eventName,
    matchUrl,
    matchSchedule,
    prizePool,
    perKill,
    teamType,
    entryFee,
    totalPlayers,
    mapName,
    matchType: normalizeMatchType(body.matchType || body.match_type || 'Paid'),
    status: normalizeStatus(body.status || body.match_status || 'Upcoming'),
    bannerId: Number(body.bannerId || body.banner_id || 0) || null,
    matchBannerId: Number(body.matchBannerId || body.match_banner_id || body.bannerId || 0) || null,
    ruleId,
    gameId,
    prizeDescription: cleanText(body.prizeDescription || body.prize_description),
    matchDescription: cleanText(body.matchDescription || body.match_description),
    privateDescription: '',
  };
}

router.get('/matches', requireMatchAccess, async (req, res) => {
  try {
    const slot = String(req.query.slot || '').trim();
    const [rows] = await pool.query(
      `${baseMatchSelect}${slot ? ' WHERE m.match_slot = ?' : ''} GROUP BY m.id, g.id, b.id, mb.id ORDER BY m.match_schedule ASC, m.created_at ASC`,
      slot ? [slot] : [],
    );
    res.json({ matches: rows.map(mapMatch) });
  } catch (error) {
    console.error('GET /api/admin/matches failed:', error);
    res.status(500).json({ error: 'Failed to load matches' });
  }
});

router.get('/matches/:id', requireMatchAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid match id' });
  }

  try {
    const [matchRows] = await pool.query(
      `${baseMatchSelect} WHERE m.id = ? GROUP BY m.id, g.id, b.id, mb.id`,
      [id],
    );
    if (!matchRows[0]) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const [participantRows] = await pool.query(
      'SELECT * FROM match_participants WHERE match_id = ? ORDER BY joined_at DESC',
      [id],
    );

    const [resultRows] = await pool.query('SELECT * FROM match_results WHERE match_id = ? LIMIT 1', [id]);

    res.json({
      match: mapMatch(matchRows[0]),
      participants: participantRows.map(mapParticipant),
      result: mapResult(resultRows[0] || null),
    });
  } catch (error) {
    console.error('GET /api/admin/matches/:id failed:', error);
    res.status(500).json({ error: 'Failed to load match details' });
  }
});

router.post('/matches', requireMatchAccess, async (req, res) => {
  const payload = validateMatchPayload(req.body);
  if (!payload.valid) return res.status(400).json({ error: payload.errors[0] });

  try {
    const [rows] = await pool.query('SELECT COALESCE(MAX(match_id), 8613) + 1 AS next_match_id FROM matches');
    const [result] = await pool.query(
      `INSERT INTO matches (
        match_id, match_slot, game_id, game_name, game_version, event_name, match_url, match_schedule,
        prize_pool, per_kill, team_type, entry_fee, total_players, map_name,
        match_banner_id, rule_id, banner_id, room_description, prize_description, match_description,
        private_description, match_type, status, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'Complete' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
      [rows[0].next_match_id, payload.matchSlot, payload.gameId, payload.gameName, payload.gameVersion, payload.eventName, payload.matchUrl, payload.matchSchedule, payload.prizePool, payload.perKill, payload.teamType, payload.entryFee, payload.totalPlayers, payload.mapName, payload.matchBannerId, payload.ruleId, null, payload.roomDescription, payload.prizeDescription, payload.matchDescription, payload.privateDescription, payload.matchType, payload.status, payload.status],
    );
    const [matchRows] = await pool.query(`${baseMatchSelect} WHERE m.id = ? GROUP BY m.id, g.id, b.id, mb.id`, [result.insertId]);
    res.status(201).json({ match: mapMatch(matchRows[0]), message: 'Match created successfully.' });
  } catch (error) {
    console.error('POST /api/admin/matches failed:', error);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

router.put('/matches/:id', requireMatchAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid match id' });
  }

  const payload = validateMatchPayload(req.body);
  if (!payload.valid) {
    return res.status(400).json({ error: payload.errors[0] });
  }

  try {
      const [existing] = await pool.query('SELECT id, status FROM matches WHERE id = ?', [id]);
    if (!existing[0]) {
      return res.status(404).json({ error: 'Match not found' });
    }
      if (payload.status !== existing[0].status && !ALLOWED_STATUS_TRANSITIONS[existing[0].status]?.includes(payload.status)) {
        return res.status(409).json({ error: `A ${existing[0].status} match cannot be changed to ${payload.status}.` });
      }

    await pool.query(
      `UPDATE matches SET
        match_slot = ?, game_id = ?, game_name = ?, game_version = ?, event_name = ?, match_url = ?, match_schedule = ?,
        prize_pool = ?, per_kill = ?, team_type = ?, entry_fee = ?, total_players = ?,
        map_name = ?, match_banner_id = ?, rule_id = ?, banner_id = ?, room_description = ?, prize_description = ?,
        match_description = ?, private_description = ?, match_type = ?, status = ?,
        completed_at = CASE WHEN ? = 'Complete' AND ? <> 'Complete' THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = ?`,
      [
        payload.matchSlot,
        payload.gameId,
        payload.gameName,
        payload.gameVersion,
        payload.eventName,
        payload.matchUrl,
        payload.matchSchedule,
        payload.prizePool,
        payload.perKill,
        payload.teamType,
        payload.entryFee,
        payload.totalPlayers,
        payload.mapName,
        payload.matchBannerId,
        payload.ruleId,
        null,
        payload.roomDescription,
        payload.prizeDescription,
        payload.matchDescription,
        payload.privateDescription,
        payload.matchType,
        payload.status,
        payload.status,
        existing[0].status,
        id,
      ],
    );

    const [matchRows] = await pool.query(
      `${baseMatchSelect} WHERE m.id = ? GROUP BY m.id, g.id, b.id, mb.id`,
      [id],
    );

    res.json({
      match: mapMatch(matchRows[0]),
      message: 'Match updated successfully.',
    });
  } catch (error) {
    console.error('PUT /api/admin/matches/:id failed:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

router.delete('/matches/:id', requireMatchAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid match id' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT id FROM matches WHERE id = ? FOR UPDATE', [id]);
    if (!rows[0]) {
      await connection.rollback();
      return res.status(404).json({ error: 'Match not found' });
    }
    const [participants] = await connection.query(
      `SELECT id, user_id, entry_fee FROM match_participants
       WHERE match_id = ? AND user_id IS NOT NULL AND status = 'Joined' AND entry_fee > 0 FOR UPDATE`,
      [id],
    );
    for (const participant of participants) {
      await connection.query(
        `INSERT INTO wallets (user_id, coin_balance, deposit_balance)
         VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE
           coin_balance = coin_balance + VALUES(coin_balance),
           deposit_balance = deposit_balance + VALUES(deposit_balance)`,
        [participant.user_id, participant.entry_fee, participant.entry_fee],
      );
      await connection.query(
        `INSERT INTO wallet_transactions (user_id, transaction_type, amount, description)
         VALUES (?, 'received', ?, ?)`,
        [participant.user_id, participant.entry_fee, `Entry fee refunded for deleted match #${id}`],
      );
    }
    await connection.query('DELETE FROM matches WHERE id = ?', [id]);
    await connection.commit();
    res.json({ ok: true, message: 'Match deleted successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('DELETE /api/admin/matches/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete match' });
  } finally {
    connection.release();
  }
});

router.patch('/matches/:id/status', requireMatchAccess, async (req, res) => {
  const id = Number(req.params.id);
  const status = normalizeStatus(req.body.status || req.body.match_status);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid match id' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query('SELECT id, status FROM matches WHERE id = ? FOR UPDATE', [id]);
    if (!existing[0]) { await connection.rollback(); return res.status(404).json({ error: 'Match not found' }); }
    if (status !== existing[0].status && !ALLOWED_STATUS_TRANSITIONS[existing[0].status]?.includes(status)) {
      await connection.rollback();
      return res.status(409).json({ error: `A ${existing[0].status} match cannot be changed to ${status}.` });
    }
    if (status === 'Cancelled' && existing[0].status !== 'Cancelled') {
      const [participants] = await connection.query(
        `SELECT id, user_id, entry_fee FROM match_participants
         WHERE match_id = ? AND user_id IS NOT NULL AND status = 'Joined' AND entry_fee > 0 FOR UPDATE`,
        [id],
      );
      for (const participant of participants) {
        await connection.query(
          `INSERT INTO wallets (user_id, coin_balance, deposit_balance)
           VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE
             coin_balance = coin_balance + VALUES(coin_balance),
             deposit_balance = deposit_balance + VALUES(deposit_balance)`,
          [participant.user_id, participant.entry_fee, participant.entry_fee],
        );
        await connection.query(
          `INSERT INTO wallet_transactions (user_id, transaction_type, amount, description)
           VALUES (?, 'received', ?, ?)`,
          [participant.user_id, participant.entry_fee, `Entry fee refunded for cancelled match #${id}`],
        );
        await connection.query(`UPDATE match_participants SET status = 'Refunded', result = 'Refunded' WHERE id = ?`, [participant.id]);
      }
    }
    await connection.query(
      `UPDATE matches SET status = ?,
       completed_at = CASE WHEN ? = 'Complete' AND ? <> 'Complete' THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = ?`,
      [status, status, existing[0].status, id],
    );
    const [rows] = await connection.query(
      `${baseMatchSelect} WHERE m.id = ? GROUP BY m.id, g.id, b.id, mb.id`,
      [id],
    );
    await connection.commit();
    res.json({
      match: mapMatch(rows[0]),
      message: `Match status updated to ${status}.`,
    });
  } catch (error) {
    await connection.rollback();
    console.error('PATCH /api/admin/matches/:id/status failed:', error);
    res.status(500).json({ error: 'Failed to update match status' });
  } finally {
    connection.release();
  }
});

router.get('/matches/:id/players', requireMatchAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid match id' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT mp.*, u.username, CONCAT(u.first_name, ' ', u.last_name) AS name
       FROM match_participants mp
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.match_id = ? ORDER BY mp.joined_at DESC`,
      [id],
    );
    res.json({ players: rows.map(mapParticipant) });
  } catch (error) {
    console.error('GET /api/admin/matches/:id/players failed:', error);
    res.status(500).json({ error: 'Failed to load participants' });
  }
});

router.get('/matches/:id/result', requireMatchAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid match id' });

  try {
    const [matchRows] = await pool.query('SELECT id, event_name, per_kill FROM matches WHERE id = ?', [id]);
    if (!matchRows[0]) return res.status(404).json({ error: 'Match not found' });
    const [rows] = await pool.query(
      `SELECT mp.*, u.username, CONCAT(u.first_name, ' ', u.last_name) AS name
       FROM match_participants mp
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.match_id = ? ORDER BY mp.joined_at ASC`,
      [id],
    );
    res.json({
      match: matchRows[0],
      players: rows.map(mapParticipant),
    });
  } catch (error) {
    console.error('GET /api/admin/matches/:id/result failed:', error);
    res.status(500).json({ error: 'Failed to load match result' });
  }
});

router.put('/matches/:id/result', requireMatchAccess, async (req, res) => {
  const id = Number(req.params.id);
  const players = Array.isArray(req.body.players) ? req.body.players : [];
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid match id' });
  if (!players.length) return res.status(400).json({ error: 'At least one joined member is required.' });

  const connection = await pool.getConnection();
  try {
    const [matches] = await connection.query('SELECT id, per_kill FROM matches WHERE id = ?', [id]);
    if (!matches[0]) return res.status(404).json({ error: 'Match not found' });
    await connection.beginTransaction();
    for (const player of players) {
      const playerId = Number(player.id);
      const kills = Math.max(0, Math.floor(Number(player.kills) || 0));
      const booyahPrize = ensureMoney(player.booyahPrize);
      const totalPrize = Number((kills * Number(matches[0].per_kill || 0) + booyahPrize).toFixed(2));
      const [previousRows] = await connection.query(
        'SELECT user_id, total_prize FROM match_participants WHERE id = ? AND match_id = ?',
        [playerId, id],
      );
      if (!previousRows[0]) continue;
      const previousPrize = Number(previousRows[0].total_prize || 0);
      const prizeDelta = Number((totalPrize - previousPrize).toFixed(2));
      await connection.query(
        `UPDATE match_participants
         SET kill_count = ?, position = ?, booyah_prize = ?, total_prize = ?, prize_amount = ?, result = ?
         WHERE id = ? AND match_id = ?`,
        [kills, cleanText(player.position) || null, booyahPrize, totalPrize, totalPrize, cleanText(player.position) || 'Completed', playerId, id],
      );
      if (previousRows[0].user_id && prizeDelta !== 0) {
        await connection.query(
          `INSERT INTO wallets (user_id, coin_balance, winning_balance)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             coin_balance = coin_balance + VALUES(coin_balance),
             winning_balance = winning_balance + VALUES(winning_balance)`,
          [previousRows[0].user_id, prizeDelta, prizeDelta],
        );
        await connection.query(
          `INSERT INTO wallet_transactions (user_id, transaction_type, amount, description)
           VALUES (?, ?, ?, ?)`,
          [
            previousRows[0].user_id,
            prizeDelta > 0 ? 'received' : 'withdraw',
            Math.abs(prizeDelta),
            prizeDelta > 0 ? `Prize received from match #${id}` : `Prize correction for match #${id}`,
          ],
        );
      }
    }
    await connection.commit();
    res.json({ ok: true, message: 'Match result saved successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('PUT /api/admin/matches/:id/result failed:', error);
    res.status(500).json({ error: 'Failed to save match result' });
  } finally {
    connection.release();
  }
});

router.patch('/matches/:id/room', requireMatchAccess, async (req, res) => {
  const id = Number(req.params.id);
  const roomId = cleanText(req.body.roomId || req.body.room_id);
  const roomPassword = cleanText(req.body.roomPassword || req.body.room_password);

  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid match id' });
  if (!roomId || !roomPassword) return res.status(400).json({ error: 'Room ID and password are required.' });

  try {
    const [matches] = await pool.query('SELECT id, match_id, event_name, room_id, room_password FROM matches WHERE id = ?', [id]);
    if (!matches[0]) return res.status(404).json({ error: 'Match not found' });
    const match = matches[0];
    await pool.query(
      'UPDATE matches SET room_id = ?, room_password = ? WHERE id = ?',
      [roomId, roomPassword, id],
    );
    let recipients = 0;
    if (match.room_id !== roomId || match.room_password !== roomPassword) {
      const [participants] = await pool.query(
        `SELECT DISTINCT user_id FROM match_participants
         WHERE match_id = ? AND user_id IS NOT NULL AND status = 'Joined'`,
        [id],
      );
      const userIds = participants.map((participant) => participant.user_id);
      if (userIds.length) {
        const title = 'Match Room Details Updated!';
        const message = `Match ID: ${match.match_id} | Room ID: ${roomId} | Pass: ${roomPassword}`;
        const [tokens] = await pool.query(
          `SELECT DISTINCT upt.token FROM user_push_tokens upt
           INNER JOIN users u ON u.id = upt.user_id
           WHERE upt.user_id IN (?) AND u.is_blocked = 0`,
          [userIds],
        );
        recipients = userIds.length;
        const delivery = await sendPushNotification({
          title,
          message,
          link: `/match/${id}`,
          targetTokens: tokens.map((row) => row.token),
          customData: { matchId: match.match_id, roomId, roomPassword, type: 'MATCH_ROOM_DETAILS' },
        });
        if (delivery.invalidTokens.length) {
          await pool.query('DELETE FROM user_push_tokens WHERE token IN (?)', [delivery.invalidTokens]);
        }
      }
    }
    res.json({ ok: true, recipients, message: 'Room details updated successfully.' });
  } catch (error) {
    console.error('PATCH /api/admin/matches/:id/room failed:', error);
    res.status(500).json({ error: 'Failed to update room details' });
  }
});

router.post('/matches/:id/players', requireMatchAccess, async (req, res) => {
  const matchId = Number(req.params.id);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ error: 'Invalid match id' });
  }

  const username = cleanText(req.body.username);
  const name = cleanText(req.body.name);
  const inGameName = cleanText(req.body.inGameName || req.body.in_game_name || username || name);
  const userId = Number(req.body.userId || req.body.user_id || 0) || null;
  const entryFee = ensureMoney(req.body.entryFee || req.body.entry_fee);

  if (!username && !name) {
    return res.status(400).json({ error: 'Username or player name is required.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO match_participants (match_id, user_id, in_game_name, entry_fee, status, result) VALUES (?, ?, ?, ?, ?, ?)',
      [matchId, userId, inGameName, entryFee, 'Joined', 'Joined'],
    );

    const [rows] = await pool.query('SELECT * FROM match_participants WHERE id = ?', [result.insertId]);
    res.status(201).json({ player: mapParticipant(rows[0]) });
  } catch (error) {
    console.error('POST /api/admin/matches/:id/players failed:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

router.delete('/matches/:id/players/:playerId', requireMatchAccess, async (req, res) => {
  const matchId = Number(req.params.id);
  const playerId = Number(req.params.playerId);

  if (!Number.isInteger(matchId) || matchId <= 0 || !Number.isInteger(playerId) || playerId <= 0) {
    return res.status(400).json({ error: 'Invalid player id' });
  }

  try {
    const [rows] = await pool.query('SELECT id FROM match_participants WHERE id = ? AND match_id = ?', [playerId, matchId]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    await pool.query('DELETE FROM match_participants WHERE id = ? AND match_id = ?', [playerId, matchId]);
    res.json({ ok: true, message: 'Participant removed.' });
  } catch (error) {
    console.error('DELETE /api/admin/matches/:id/players/:playerId failed:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

module.exports = router;
