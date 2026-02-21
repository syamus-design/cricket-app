'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/users/me  – get the authenticated user's profile
 */
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

/**
 * GET /api/users/me/matches  – get all matches the user participated in (as a player)
 */
router.get('/me/matches', authenticate, (req, res) => {
  const db = getDb();

  // Matches via teams the user belongs to (accepted)
  const matches = db.prepare(`
    SELECT DISTINCT
           m.id,
           m.status,
           m.scheduled_at,
           m.score_team1,
           m.score_team2,
           m.winner_id,
           t1.name AS team1_name,
           t2.name AS team2_name,
           w.name  AS winner_name,
           tour.id   AS tournament_id,
           tour.name AS tournament_name
    FROM matches m
    JOIN teams t1   ON t1.id = m.team1_id
    JOIN teams t2   ON t2.id = m.team2_id
    LEFT JOIN teams w ON w.id = m.winner_id
    JOIN tournaments tour ON tour.id = m.tournament_id
    JOIN team_players tp ON (tp.team_id = m.team1_id OR tp.team_id = m.team2_id)
    WHERE tp.player_id = ? AND tp.status = 'accepted'
    ORDER BY m.scheduled_at DESC
  `).all(req.user.id);

  res.json(matches);
});

/**
 * GET /api/users/me/invitations  – list all pending team invitations for the logged-in player
 */
router.get('/me/invitations', authenticate, (req, res) => {
  const db = getDb();
  const invitations = db.prepare(`
    SELECT tp.id AS membership_id,
           tp.status,
           tp.created_at AS invited_at,
           tm.id   AS team_id,
           tm.name AS team_name,
           tour.id   AS tournament_id,
           tour.name AS tournament_name
    FROM team_players tp
    JOIN teams tm ON tm.id = tp.team_id
    JOIN tournaments tour ON tour.id = tm.tournament_id
    WHERE tp.player_id = ?
    ORDER BY tp.created_at DESC
  `).all(req.user.id);

  res.json(invitations);
});

/**
 * GET /api/users/me/teams  – list all teams the user belongs to or organises
 */
router.get('/me/teams', authenticate, (req, res) => {
  const db = getDb();

  let teams;
  if (req.user.role === 'player') {
    teams = db.prepare(`
      SELECT tm.id, tm.name, tm.tournament_id, tp.status AS membership_status,
             tour.name AS tournament_name
      FROM team_players tp
      JOIN teams tm ON tm.id = tp.team_id
      JOIN tournaments tour ON tour.id = tm.tournament_id
      WHERE tp.player_id = ?
      ORDER BY tp.created_at DESC
    `).all(req.user.id);
  } else {
    teams = db.prepare(`
      SELECT tm.*, tour.name AS tournament_name
      FROM teams tm
      JOIN tournaments tour ON tour.id = tm.tournament_id
      WHERE tm.organizer_id = ?
      ORDER BY tm.created_at DESC
    `).all(req.user.id);
  }

  res.json(teams);
});

/**
 * GET /api/users/me/tournaments  – list tournaments organised by the logged-in organizer
 */
router.get('/me/tournaments', authenticate, (req, res) => {
  const db = getDb();
  const tournaments = db.prepare(
    'SELECT * FROM tournaments WHERE organizer_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json(tournaments);
});

module.exports = router;
