'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/teams  – create a team inside a tournament (team_organizer only)
 */
router.post('/', authenticate, requireRole('team_organizer', 'tournament_organizer'), (req, res) => {
  const { name, tournament_id } = req.body;
  if (!name || !tournament_id) {
    return res.status(400).json({ error: 'name and tournament_id are required' });
  }

  const db = getDb();
  const tournament = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(tournament_id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  const result = db.prepare(
    'INSERT INTO teams (name, tournament_id, organizer_id) VALUES (?, ?, ?)'
  ).run(name, tournament_id, req.user.id);

  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(team);
});

/**
 * GET /api/teams/:id  – get team details with its players
 */
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const team = db.prepare(`
    SELECT tm.*, u.name AS organizer_name
    FROM teams tm
    JOIN users u ON u.id = tm.organizer_id
    WHERE tm.id = ?
  `).get(req.params.id);

  if (!team) return res.status(404).json({ error: 'Team not found' });

  const players = db.prepare(`
    SELECT tp.id AS membership_id, tp.status, tp.created_at AS invited_at,
           u.id, u.name, u.email
    FROM team_players tp
    JOIN users u ON u.id = tp.player_id
    WHERE tp.team_id = ?
  `).all(team.id);

  res.json({ ...team, players });
});

/**
 * POST /api/teams/:id/players  – invite a player to the team (team organizer only)
 */
router.post('/:id/players', authenticate, (req, res) => {
  const db = getDb();
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  if (team.organizer_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the team organizer can invite players' });
  }

  const { player_id } = req.body;
  if (!player_id) return res.status(400).json({ error: 'player_id is required' });

  const player = db.prepare('SELECT id, name, email FROM users WHERE id = ? AND role = ?')
    .get(player_id, 'player');
  if (!player) return res.status(404).json({ error: 'Player not found' });

  try {
    db.prepare('INSERT INTO team_players (team_id, player_id) VALUES (?, ?)').run(team.id, player_id);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Player already invited to this team' });
    }
    throw err;
  }

  res.status(201).json({ message: `Player ${player.name} invited to team ${team.name}`, player });
});

/**
 * PATCH /api/teams/:id/players/:playerId  – player accepts or rejects an invitation
 */
router.patch('/:id/players/:playerId', authenticate, (req, res) => {
  const db = getDb();
  const { status } = req.body;
  const validStatuses = ['accepted', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  if (req.user.id !== Number(req.params.playerId)) {
    return res.status(403).json({ error: 'You can only update your own invitation' });
  }

  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const membership = db.prepare(
    'SELECT * FROM team_players WHERE team_id = ? AND player_id = ?'
  ).get(team.id, req.user.id);
  if (!membership) return res.status(404).json({ error: 'Invitation not found' });

  db.prepare('UPDATE team_players SET status = ? WHERE team_id = ? AND player_id = ?')
    .run(status, team.id, req.user.id);

  res.json({ message: `Invitation ${status}`, team_id: team.id, player_id: req.user.id, status });
});

module.exports = router;
