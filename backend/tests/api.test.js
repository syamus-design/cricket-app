'use strict';

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Use a dedicated test database
process.env.DB_PATH = path.join(__dirname, 'test.db');

const app = require('../app');
const { closeDb } = require('../database');

afterAll(() => {
  closeDb();
  if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
  }
});

describe('Auth', () => {
  test('register a player', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Player',
      email: 'alice@test.com',
      password: 'secret123',
      role: 'player',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('player');
  });

  test('duplicate email returns 409', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Dup',
      email: 'alice@test.com',
      password: 'secret123',
    });
    expect(res.status).toBe(409);
  });

  test('login with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@test.com',
      password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('login with wrong password returns 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@test.com',
      password: 'wrong',
    });
    expect(res.status).toBe(401);
  });
});

describe('Tournaments', () => {
  let orgToken;
  let tournamentId;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Org User',
      email: 'org@test.com',
      password: 'secret123',
      role: 'tournament_organizer',
    });
    orgToken = reg.body.token;
  });

  test('create tournament', async () => {
    const res = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ name: 'IPL 2024', location: 'India', start_date: '2024-03-01' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('IPL 2024');
    tournamentId = res.body.id;
  });

  test('non-organizer cannot create tournament', async () => {
    const playerReg = await request(app).post('/api/auth/register').send({
      name: 'Bob Player',
      email: 'bob@test.com',
      password: 'secret123',
      role: 'player',
    });
    const res = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${playerReg.body.token}`)
      .send({ name: 'Fake Tournament' });
    expect(res.status).toBe(403);
  });

  test('get all tournaments', async () => {
    const res = await request(app).get('/api/tournaments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('get tournament by id', async () => {
    const res = await request(app).get(`/api/tournaments/${tournamentId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(tournamentId);
    expect(res.body.teams).toBeDefined();
    expect(res.body.matches).toBeDefined();
  });

  test('unknown tournament id returns 404', async () => {
    const res = await request(app).get('/api/tournaments/99999');
    expect(res.status).toBe(404);
  });
});

describe('Teams', () => {
  let teamOrgToken;
  let playerToken;
  let playerId;
  let tournamentId;
  let teamId;

  beforeAll(async () => {
    // Tournament organizer creates tournament
    const orgReg = await request(app).post('/api/auth/register').send({
      name: 'Tour Org 2',
      email: 'torg2@test.com',
      password: 'secret123',
      role: 'tournament_organizer',
    });
    const tourRes = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${orgReg.body.token}`)
      .send({ name: 'T20 Cup' });
    tournamentId = tourRes.body.id;

    // Team organizer
    const teamOrgReg = await request(app).post('/api/auth/register').send({
      name: 'Team Org',
      email: 'teamorg@test.com',
      password: 'secret123',
      role: 'team_organizer',
    });
    teamOrgToken = teamOrgReg.body.token;

    // Player
    const playerReg = await request(app).post('/api/auth/register').send({
      name: 'Charlie',
      email: 'charlie@test.com',
      password: 'secret123',
      role: 'player',
    });
    playerToken = playerReg.body.token;
    playerId = playerReg.body.user.id;
  });

  test('team organizer creates team', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${teamOrgToken}`)
      .send({ name: 'Mumbai Indians', tournament_id: tournamentId });
    expect(res.status).toBe(201);
    teamId = res.body.id;
  });

  test('invite player to team', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/players`)
      .set('Authorization', `Bearer ${teamOrgToken}`)
      .send({ player_id: playerId });
    expect(res.status).toBe(201);
  });

  test('duplicate invite returns 409', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/players`)
      .set('Authorization', `Bearer ${teamOrgToken}`)
      .send({ player_id: playerId });
    expect(res.status).toBe(409);
  });

  test('player accepts invitation', async () => {
    const res = await request(app)
      .patch(`/api/teams/${teamId}/players/${playerId}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ status: 'accepted' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  test('get team details includes players', async () => {
    const res = await request(app)
      .get(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${teamOrgToken}`);
    expect(res.status).toBe(200);
    expect(res.body.players.length).toBeGreaterThan(0);
    expect(res.body.players[0].status).toBe('accepted');
  });
});

describe('User Profile & History', () => {
  let playerToken;
  let orgToken;

  beforeAll(async () => {
    const pReg = await request(app).post('/api/auth/register').send({
      name: 'Dave',
      email: 'dave@test.com',
      password: 'secret123',
      role: 'player',
    });
    playerToken = pReg.body.token;

    const oReg = await request(app).post('/api/auth/register').send({
      name: 'Eve Organizer',
      email: 'eve@test.com',
      password: 'secret123',
      role: 'tournament_organizer',
    });
    orgToken = oReg.body.token;
  });

  test('GET /api/users/me returns profile', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('dave@test.com');
  });

  test('GET /api/users/me/invitations lists invitations', async () => {
    const res = await request(app)
      .get('/api/users/me/invitations')
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/users/me/matches lists match history', async () => {
    const res = await request(app)
      .get('/api/users/me/matches')
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/users/me/tournaments lists organizer tournaments', async () => {
    const res = await request(app)
      .get('/api/users/me/tournaments')
      .set('Authorization', `Bearer ${orgToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('Matches', () => {
  let orgToken;
  let tournamentId;
  let team1Id;
  let team2Id;
  let matchId;

  beforeAll(async () => {
    const oReg = await request(app).post('/api/auth/register').send({
      name: 'Frank Org',
      email: 'frank@test.com',
      password: 'secret123',
      role: 'tournament_organizer',
    });
    orgToken = oReg.body.token;

    const tourRes = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ name: 'Super Cup' });
    tournamentId = tourRes.body.id;

    const t1 = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ name: 'Team Alpha', tournament_id: tournamentId });
    team1Id = t1.body.id;

    const t2 = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ name: 'Team Beta', tournament_id: tournamentId });
    team2Id = t2.body.id;
  });

  test('schedule a match', async () => {
    const res = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ tournament_id: tournamentId, team1_id: team1Id, team2_id: team2Id });
    expect(res.status).toBe(201);
    matchId = res.body.id;
  });

  test('get match by id', async () => {
    const res = await request(app).get(`/api/matches/${matchId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(matchId);
  });

  test('update match result', async () => {
    const res = await request(app)
      .patch(`/api/matches/${matchId}`)
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ status: 'completed', winner_id: team1Id, score_team1: 180, score_team2: 160 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.score_team1).toBe(180);
  });
});
