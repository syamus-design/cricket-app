# 🏏 Cricket App

A full-stack cricket management platform where users can register, join teams, participate in tournaments, and track their match history.

---

## Features

| Role | Capabilities |
|------|-------------|
| **Player** | Register, browse tournaments, accept/reject team invitations, view match history |
| **Team Organizer** | Create teams inside tournaments, invite players by user ID |
| **Tournament Organizer** | Create & manage tournaments, schedule matches, record results |

---

## Project Structure

```
cricket-app/
├── backend/          # Node.js / Express REST API (SQLite via node:sqlite)
│   ├── app.js        # Express application
│   ├── server.js     # HTTP server entry point
│   ├── database.js   # SQLite schema & connection
│   ├── middleware/
│   │   └── auth.js   # JWT authentication & role guard
│   ├── routes/
│   │   ├── auth.js         # Register / Login
│   │   ├── tournaments.js  # Tournament CRUD
│   │   ├── teams.js        # Team CRUD + player invitations
│   │   ├── matches.js      # Match scheduling & results
│   │   └── users.js        # User profile & history
│   └── tests/
│       └── api.test.js     # Jest integration tests
└── frontend/         # Vanilla HTML/CSS/JS single-page app
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Quick Start

### Prerequisites

- **Node.js ≥ 22** (uses the built-in `node:sqlite` module)

### 1 – Backend

```bash
cd backend
npm install
npm start           # or: npm run dev  (requires nodemon)
```

The API will be available at `http://localhost:3000`.

### 2 – Frontend

Open `frontend/index.html` directly in a browser, or serve it with any static file server:

```bash
npx serve frontend
```

> Make sure the backend is running before using the frontend.

### 3 – Tests

```bash
cd backend
npm test
```

---

## API Reference

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive a JWT |

**Register body**
```json
{ "name": "Alice", "email": "alice@example.com", "password": "secret", "role": "player" }
```
`role` must be one of `player`, `team_organizer`, `tournament_organizer`.

---

### Tournaments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tournaments` | — | List all tournaments |
| `GET` | `/api/tournaments/:id` | — | Get tournament by ID (includes teams & matches) |
| `POST` | `/api/tournaments` | tournament_organizer | Create tournament |
| `PATCH` | `/api/tournaments/:id` | tournament_organizer | Update tournament |

---

### Teams

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/teams` | team_organizer / tournament_organizer | Create team inside a tournament |
| `GET` | `/api/teams/:id` | authenticated | Get team with players |
| `POST` | `/api/teams/:id/players` | team organizer | Invite a player |
| `PATCH` | `/api/teams/:id/players/:playerId` | player | Accept or reject invitation |

---

### Matches

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/matches` | tournament_organizer | Schedule a match |
| `GET` | `/api/matches/:id` | — | Get match details |
| `PATCH` | `/api/matches/:id` | tournament_organizer | Update result / status |

---

### User Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/users/me` | authenticated | Get own profile |
| `GET` | `/api/users/me/matches` | authenticated | Match history |
| `GET` | `/api/users/me/invitations` | authenticated | All team invitations |
| `GET` | `/api/users/me/teams` | authenticated | Teams the user belongs to or organises |
| `GET` | `/api/users/me/tournaments` | authenticated | Tournaments organised by user |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `JWT_SECRET` | `cricket-app-secret-key` | JWT signing secret (change in production!) |
| `DB_PATH` | `./backend/cricket.db` | Path to SQLite database file |
