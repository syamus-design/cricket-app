'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'cricket.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'player',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      description  TEXT,
      location     TEXT,
      start_date   TEXT,
      end_date     TEXT,
      status       TEXT    NOT NULL DEFAULT 'upcoming',
      organizer_id INTEGER NOT NULL REFERENCES users(id),
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      organizer_id INTEGER NOT NULL REFERENCES users(id),
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_players (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id    INTEGER NOT NULL REFERENCES teams(id),
      player_id  INTEGER NOT NULL REFERENCES users(id),
      status     TEXT    NOT NULL DEFAULT 'invited',
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(team_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      team1_id      INTEGER NOT NULL REFERENCES teams(id),
      team2_id      INTEGER NOT NULL REFERENCES teams(id),
      scheduled_at  TEXT,
      status        TEXT    NOT NULL DEFAULT 'scheduled',
      winner_id     INTEGER REFERENCES teams(id),
      score_team1   INTEGER,
      score_team2   INTEGER,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
