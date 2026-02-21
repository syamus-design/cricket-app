'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/tournaments  – create (tournament_organizer only)
 */
router.post('/', authenticate, requireRole('tournament_organizer'), (req, res) => {
  const { name, description, location, start_date, end_date } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO tournaments (name, description, location, start_date, end_date, organizer_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(name, description || null, location || null, start_date || null, end_date || null, req.user.id);

  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tournament);
});

/**
 * GET /api/tournaments  – list all tournaments
 */
router.get('/', (req, res) => {
  const db = getDb();
  const tournaments = db.prepare(`
    SELECT t.*, u.name AS organizer_name
    FROM tournaments t
    JOIN users u ON u.id = t.organizer_id
    ORDER BY t.created_at DESC
  `).all();
  res.json(tournaments);
});

/**
 * GET /api/tournaments/:id  – find tournament by ID
 */
router.get('/:id', (req, res) => {
  const db = getDb();
  const tournament = db.prepare(`
    SELECT t.*, u.name AS organizer_name
    FROM tournaments t
    JOIN users u ON u.id = t.organizer_id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  const teams = db.prepare(`
    SELECT tm.*, u.name AS organizer_name
    FROM teams tm
    JOIN users u ON u.id = tm.organizer_id
    WHERE tm.tournament_id = ?
  `).all(tournament.id);

  const matches = db.prepare(`
    SELECT m.*,
           t1.name AS team1_name,
           t2.name AS team2_name,
           w.name  AS winner_name
    FROM matches m
    JOIN teams t1 ON t1.id = m.team1_id
    JOIN teams t2 ON t2.id = m.team2_id
    LEFT JOIN teams w ON w.id = m.winner_id
    WHERE m.tournament_id = ?
    ORDER BY m.scheduled_at
  `).all(tournament.id);

  res.json({ ...tournament, teams, matches });
});

/**
 * PATCH /api/tournaments/:id  – update status (organizer only)
 */
router.patch('/:id', authenticate, (req, res) => {
  const db = getDb();
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  if (tournament.organizer_id !== req.user.id && req.user.role !== 'tournament_organizer') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const { name, description, location, start_date, end_date, status } = req.body;
  const validStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  db.prepare(`
    UPDATE tournaments
    SET name        = COALESCE(?, name),
        description = COALESCE(?, description),
        location    = COALESCE(?, location),
        start_date  = COALESCE(?, start_date),
        end_date    = COALESCE(?, end_date),
        status      = COALESCE(?, status)
    WHERE id = ?
  `).run(name || null, description || null, location || null,
         start_date || null, end_date || null, status || null, tournament.id);

  res.json(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournament.id));
});

module.exports = router;
