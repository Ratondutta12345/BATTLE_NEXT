const express = require('express');
const pool = require('../lib/db');

const router = express.Router();

router.get('/top', async (_req, res) => {
  try {
    const [rows] = await pool.query(
        `SELECT u.id, u.username, u.first_name, u.last_name,
          COALESCE(SUM(CASE WHEN m.status = 'Complete' THEN mp.total_prize ELSE 0 END), 0) AS winning_coins,
          SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(mp.in_game_name, '') ORDER BY mp.joined_at DESC SEPARATOR '||'), '||', 1) AS in_game_name,
          COUNT(DISTINCT mp.match_id) AS matches
         FROM users u
         INNER JOIN match_participants mp ON mp.user_id = u.id
         INNER JOIN matches m ON m.id = mp.match_id
         GROUP BY u.id, u.username, u.first_name, u.last_name
         HAVING winning_coins > 0
         ORDER BY winning_coins DESC, matches DESC, u.id ASC
         LIMIT 15`,
    );

    res.json({
      players: rows.map((row, index) => ({
        rank: index + 1,
        id: row.id,
        username: row.username,
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        inGameName: row.in_game_name || '—',
        winningCoins: Number(row.winning_coins || 0),
        matches: Number(row.matches || 0),
      })),
    });
  } catch (error) {
    console.error('GET /api/players/top failed:', error);
    res.status(500).json({ error: 'Failed to fetch top players' });
  }
});

module.exports = router;
