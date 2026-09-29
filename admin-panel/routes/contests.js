const express = require('express');
const pool = require('../lib/db');

const router = express.Router();

router.get('/my/:status', async (req, res) => {
  const allowedStatuses = new Set(['upcoming', 'ongoing', 'completed']);
  if (!allowedStatuses.has(req.params.status)) {
    return res.status(400).json({ error: 'Invalid contest status' });
  }

  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'A valid userId is required' });
  }

  const matchStatus = req.params.status === 'completed' ? 'Complete' : req.params.status === 'ongoing' ? 'Ongoing' : 'Upcoming';
  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.match_id, m.event_name, m.game_name, m.game_version, m.status,
        DATE_FORMAT(m.match_schedule, '%Y-%m-%dT%H:%i:%sZ') AS match_schedule_utc,
        m.prize_pool, m.per_kill, m.entry_fee, m.team_type, m.map_name, m.total_players,
        mb.image_url AS banner_url,
        (SELECT COUNT(*) FROM match_participants joined_mp WHERE joined_mp.match_id = m.id) AS joined_players
       FROM matches m
       LEFT JOIN match_banners mb ON mb.id = m.match_banner_id
       WHERE m.status = ?
         AND EXISTS (
           SELECT 1 FROM match_participants mp
           WHERE mp.match_id = m.id AND mp.user_id = ?
         )
       ORDER BY m.match_schedule DESC`,
      [matchStatus, userId],
    );
    res.json({ contests: rows.map((row) => ({
      id: row.id,
      matchId: row.match_id,
      name: row.event_name,
      gameName: row.game_name,
      gameVersion: row.game_version,
      status: row.status,
      startsAt: row.match_schedule_utc,
      perKill: Number(row.per_kill ?? 0),
      entryFee: Number(row.entry_fee ?? 0),
      prizePool: Number(row.prize_pool ?? 0),
      teamType: row.team_type,
      map: row.map_name,
      totalPlayers: Number(row.total_players ?? 0),
      joinedPlayers: Number(row.joined_players ?? 0),
      bannerUrl: row.banner_url,
      inGameName: row.in_game_name,
      joinedAt: row.joined_at,
    })) });
  } catch (error) {
    console.error('GET /api/contests/my/:status failed:', error);
    res.status(500).json({ error: 'Failed to fetch joined matches' });
  }
});

module.exports = router;