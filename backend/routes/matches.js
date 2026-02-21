'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/matches  – schedule a match (tournament_organizer only)
 */
router.post('/', authenticate, requireRole('tournament_organizer'), (req, res) => {
  const { tournament_id, team1_id, team2_id, scheduled_at } = req.body;
  if (!tournament_id || !team1_id || !team2_id) {
    return res.status(400).json({ error: 'tournament_id, team1_id and team2_id are required' });
  }
  if (team1_id === team2_id) {
    return res.status(400).json({ error: 'team1_id and team2_id must be different' });
  }

  const db = getDb();
  const tournament = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(tournament_id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  for (const tid of [team1_id, team2_id]) {
    const team = db.prepare('SELECT id FROM teams WHERE id = ? AND tournament_id = ?')
      .get(tid, tournament_id);
    if (!team) return res.status(404).json({ error: `Team ${tid} not found in this tournament` });
  }

  const result = db.prepare(
    `INSERT INTO matches (tournament_id, team1_id, team2_id, scheduled_at)
     VALUES (?, ?, ?, ?)`
  ).run(tournament_id, team1_id, team2_id, scheduled_at || null);

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(match);
});

/**
 * PATCH /api/matches/:id  – update match result (tournament_organizer only)
 */
router.patch('/:id', authenticate, requireRole('tournament_organizer'), (req, res) => {
  const db = getDb();
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const { status, winner_id, score_team1, score_team2 } = req.body;
  const validStatuses = ['scheduled', 'ongoing', 'completed', 'cancelled'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  if (winner_id) {
    const team = db.prepare('SELECT id FROM teams WHERE id = ? AND tournament_id = ?')
      .get(winner_id, match.tournament_id);
    if (!team) return res.status(400).json({ error: 'winner_id is not a team in this tournament' });
  }

  db.prepare(`
    UPDATE matches
    SET status       = COALESCE(?, status),
        winner_id    = COALESCE(?, winner_id),
        score_team1  = COALESCE(?, score_team1),
        score_team2  = COALESCE(?, score_team2)
    WHERE id = ?
  `).run(status || null, winner_id || null,
         score_team1 != null ? score_team1 : null,
         score_team2 != null ? score_team2 : null,
         match.id);

  res.json(db.prepare('SELECT * FROM matches WHERE id = ?').get(match.id));
});

/**
 * GET /api/matches/:id  – get match details
 */
router.get('/:id', (req, res) => {
  const db = getDb();
  const match = db.prepare(`
    SELECT m.*,
           t1.name AS team1_name,
           t2.name AS team2_name,
           w.name  AS winner_name,
           tour.name AS tournament_name
    FROM matches m
    JOIN teams t1   ON t1.id = m.team1_id
    JOIN teams t2   ON t2.id = m.team2_id
    LEFT JOIN teams w ON w.id = m.winner_id
    JOIN tournaments tour ON tour.id = m.tournament_id
    WHERE m.id = ?
  `).get(req.params.id);

  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json(match);
});

module.exports = router;
