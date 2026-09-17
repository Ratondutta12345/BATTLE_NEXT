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
      `SELECT m.id, m.match_id, m.event_name, m.game_name, m.game_version, m.status, m.match_schedule,
        m.prize_pool, m.per_kill, m.entry_fee, m.team_type, m.map_name, m.total_players,
        mb.image_url AS banner_url,
        (SELECT COUNT(*) FROM match_participants joined_mp WHERE joined_mp.match_id = m.id) AS joined_players,
        mp.in_game_name, mp.joined_at
       FROM matches m
       INNER JOIN match_participants mp ON mp.match_id = m.id AND mp.user_id = ?
       LEFT JOIN match_banners mb ON mb.id = m.match_banner_id
       WHERE m.status = ?
       ORDER BY m.match_schedule DESC, mp.joined_at DESC`,
      [userId, matchStatus],
    );
    res.json({ contests: rows.map((row) => ({
      id: row.id,
      matchId: row.match_id,
      name: row.event_name,
      gameName: row.game_name,
      gameVersion: row.game_version,
      status: row.status,
      startsAt: row.match_schedule,
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