'use strict';

const API = 'http://localhost:3000/api';

/* ── State ── */
let token = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

/* ── Init ── */
window.onload = () => {
  updateNav();
  showPage(token ? 'tournaments' : 'home');
};

/* ── Page routing ── */
function showPage(name) {
  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`page-${name}`)?.classList.remove('hidden');

  if (name === 'tournaments') loadTournaments();
  if (name === 'profile') loadProfile();
}

/* ── Nav ── */
function updateNav() {
  if (token && currentUser) {
    document.getElementById('nav-auth').classList.add('hidden');
    document.getElementById('nav-user').classList.remove('hidden');
    document.getElementById('nav-username').textContent = currentUser.name;

    const btn = document.getElementById('btn-create-tournament');
    if (currentUser.role === 'tournament_organizer') btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  } else {
    document.getElementById('nav-auth').classList.remove('hidden');
    document.getElementById('nav-user').classList.add('hidden');
  }
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateNav();
  showPage('home');
}

/* ── Auth ── */
async function register() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  const errEl = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  if (!name || !email || !password) {
    return showError(errEl, 'All fields are required.');
  }

  const res = await apiFetch('/auth/register', 'POST', { name, email, password, role });
  if (res.error) return showError(errEl, res.error);

  saveAuth(res.token, res.user);
  showPage('tournaments');
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  const res = await apiFetch('/auth/login', 'POST', { email, password });
  if (res.error) return showError(errEl, res.error);

  saveAuth(res.token, res.user);
  showPage('tournaments');
}

function saveAuth(t, user) {
  token = t;
  currentUser = user;
  localStorage.setItem('token', t);
  localStorage.setItem('user', JSON.stringify(user));
  updateNav();
}

/* ── Tournaments ── */
async function loadTournaments() {
  const res = await apiFetch('/tournaments');
  const list = document.getElementById('tournaments-list');
  if (!Array.isArray(res) || res.length === 0) {
    list.innerHTML = '<p class="empty">No tournaments yet.</p>';
    return;
  }
  list.innerHTML = res.map(t => tournamentCard(t)).join('');
}

function tournamentCard(t) {
  return `
    <div class="card tour-card" onclick="openTournament(${t.id})">
      <h3>${esc(t.name)}</h3>
      <p class="meta">📍 ${esc(t.location || '—')}</p>
      <p class="meta">📅 ${esc(t.start_date || '—')} – ${esc(t.end_date || '—')}</p>
      <p class="meta">Organizer: ${esc(t.organizer_name)}</p>
      <span class="badge badge-${t.status}">${t.status}</span>
    </div>`;
}

async function searchTournamentById() {
  const id = document.getElementById('tour-search-id').value.trim();
  if (!id) return;
  const res = await apiFetch(`/tournaments/${id}`);
  const list = document.getElementById('tournaments-list');
  if (res.error) {
    list.innerHTML = `<p class="empty">${esc(res.error)}</p>`;
    return;
  }
  list.innerHTML = tournamentCard(res);
}

async function openTournament(id) {
  const data = await apiFetch(`/tournaments/${id}`);
  if (data.error) return alert(data.error);

  const isOrganizerOrTeamOrg = currentUser && (
    currentUser.role === 'tournament_organizer' ||
    currentUser.role === 'team_organizer'
  );

  const teamsHtml = data.teams.length
    ? data.teams.map(tm => `
        <li>
          <span>${esc(tm.name)}</span>
          <span style="color:#718096;font-size:.8rem"> (organizer: ${esc(tm.organizer_name)})</span>
          ${currentUser && tm.organizer_id === currentUser.id ? `
            <button class="btn-sm" onclick="openInvitePlayer(${tm.id},'${esc(tm.name)}')">Invite Player</button>
          ` : ''}
        </li>`).join('')
    : '<li class="empty">No teams yet.</li>';

  const matchesHtml = data.matches.length
    ? data.matches.map(m => `
        <li>
          <div class="match-row">
            <span class="match-teams">${esc(m.team1_name)} vs ${esc(m.team2_name)}</span>
            <span><span class="badge badge-${m.status}">${m.status}</span></span>
          </div>
          ${m.score_team1 != null ? `<div class="match-score">Score: ${m.score_team1} – ${m.score_team2}${m.winner_name ? ` | Winner: ${esc(m.winner_name)}` : ''}</div>` : ''}
          ${m.scheduled_at ? `<div class="match-score">📅 ${esc(m.scheduled_at)}</div>` : ''}
        </li>`).join('')
    : '<li class="empty">No matches yet.</li>';

  document.getElementById('tournament-detail-content').innerHTML = `
    <div class="detail-header">
      <div class="badge badge-${data.status}">${data.status}</div>
      <h2>${esc(data.name)}</h2>
      ${data.description ? `<p>${esc(data.description)}</p>` : ''}
      <p class="meta">📍 ${esc(data.location || '—')} &nbsp;|&nbsp; 📅 ${esc(data.start_date || '—')} – ${esc(data.end_date || '—')}</p>
      <p class="meta">Organizer: ${esc(data.organizer_name)} &nbsp;|&nbsp; Tournament ID: <strong>#${data.id}</strong></p>
    </div>
    ${isOrganizerOrTeamOrg ? `<button onclick="openCreateTeam(${data.id},'${esc(data.name)}')">+ Add Team</button>` : ''}
    <div class="section-title">Teams</div>
    <ul class="players-list">${teamsHtml}</ul>
    <div class="section-title">Matches</div>
    <ul class="matches-list">${matchesHtml}</ul>
  `;
  showPage('tournament-detail');
}

/* ── Create Tournament ── */
async function createTournament() {
  const name = document.getElementById('ct-name').value.trim();
  const description = document.getElementById('ct-description').value.trim();
  const location = document.getElementById('ct-location').value.trim();
  const start_date = document.getElementById('ct-start').value;
  const end_date = document.getElementById('ct-end').value;
  const errEl = document.getElementById('ct-error');
  errEl.classList.add('hidden');
  if (!name) return showError(errEl, 'Name is required.');

  const res = await apiFetch('/tournaments', 'POST', { name, description, location, start_date, end_date });
  if (res.error) return showError(errEl, res.error);
  showPage('tournaments');
}

/* ── Create Team ── */
function openCreateTeam(tournamentId, tournamentName) {
  document.getElementById('ct2-tournament-label').textContent = `Tournament: ${tournamentName}`;
  document.getElementById('ct2-tournament-id').value = tournamentId;
  document.getElementById('ct2-name').value = '';
  document.getElementById('ct2-error').classList.add('hidden');
  showPage('create-team');
}

async function createTeam() {
  const name = document.getElementById('ct2-name').value.trim();
  const tournament_id = document.getElementById('ct2-tournament-id').value;
  const errEl = document.getElementById('ct2-error');
  errEl.classList.add('hidden');
  if (!name) return showError(errEl, 'Team name is required.');

  const res = await apiFetch('/teams', 'POST', { name, tournament_id: Number(tournament_id) });
  if (res.error) return showError(errEl, res.error);
  openTournament(Number(tournament_id));
}

/* ── Invite Player ── */
function openInvitePlayer(teamId, teamName) {
  document.getElementById('invite-team-label').textContent = `Team: ${teamName}`;
  document.getElementById('invite-team-id').value = teamId;
  document.getElementById('invite-player-id').value = '';
  document.getElementById('invite-error').classList.add('hidden');
  document.getElementById('invite-success').classList.add('hidden');
  showPage('invite-player');
}

async function invitePlayer() {
  const teamId = document.getElementById('invite-team-id').value;
  const playerId = document.getElementById('invite-player-id').value;
  const errEl = document.getElementById('invite-error');
  const okEl = document.getElementById('invite-success');
  errEl.classList.add('hidden');
  okEl.classList.add('hidden');
  if (!playerId) return showError(errEl, 'Player ID is required.');

  const res = await apiFetch(`/teams/${teamId}/players`, 'POST', { player_id: Number(playerId) });
  if (res.error) return showError(errEl, res.error);
  okEl.textContent = res.message;
  okEl.classList.remove('hidden');
}

/* ── Profile ── */
async function loadProfile() {
  if (!token) return showPage('login');

  const [user, invitations, matches, teams, tournaments] = await Promise.all([
    apiFetch('/users/me'),
    apiFetch('/users/me/invitations'),
    apiFetch('/users/me/matches'),
    apiFetch('/users/me/teams'),
    apiFetch('/users/me/tournaments'),
  ]);

  const totalMatches = Array.isArray(matches) ? matches.length : 0;
  const userTeamIds = new Set(Array.isArray(teams) ? teams.map(t => t.id) : []);
  const wins = Array.isArray(matches)
    ? matches.filter(m => m.winner_id && userTeamIds.has(m.winner_id)).length
    : 0;

  const invHtml = Array.isArray(invitations) && invitations.length
    ? `<table><thead><tr><th>Team</th><th>Tournament</th><th>Status</th><th>Action</th></tr></thead><tbody>
       ${invitations.map(i => `
         <tr>
           <td>${esc(i.team_name)}</td>
           <td>${esc(i.tournament_name)}</td>
           <td><span class="badge badge-${invBadge(i.status)}">${i.status}</span></td>
           <td>${i.status === 'invited' ? `
             <button class="btn-sm btn-success" onclick="respondInvite(${i.team_id},${user.id},'accepted')">Accept</button>
             <button class="btn-sm btn-danger" onclick="respondInvite(${i.team_id},${user.id},'rejected')">Reject</button>
           ` : '—'}</td>
         </tr>`).join('')}
       </tbody></table>`
    : '<p class="empty">No invitations.</p>';

  const matchHtml = Array.isArray(matches) && matches.length
    ? `<table><thead><tr><th>Tournament</th><th>Match</th><th>Score</th><th>Status</th></tr></thead><tbody>
       ${matches.map(m => `
         <tr>
           <td>${esc(m.tournament_name)}</td>
           <td>${esc(m.team1_name)} vs ${esc(m.team2_name)}</td>
           <td>${m.score_team1 != null ? `${m.score_team1}–${m.score_team2}` : '—'}</td>
           <td><span class="badge badge-${m.status}">${m.status}</span></td>
         </tr>`).join('')}
       </tbody></table>`
    : '<p class="empty">No match history yet.</p>';

  const teamsHtml = Array.isArray(teams) && teams.length
    ? `<ul class="players-list">${teams.map(t => `
         <li>🏏 ${esc(t.name)} <span style="color:#718096;font-size:.8rem">(${esc(t.tournament_name)})
         ${t.membership_status ? ` – ${t.membership_status}` : ''}</span></li>`).join('')}
       </ul>`
    : '<p class="empty">No teams yet.</p>';

  const tourHtml = Array.isArray(tournaments) && tournaments.length
    ? `<ul class="players-list">${tournaments.map(t => `
         <li onclick="openTournament(${t.id})" style="cursor:pointer">🏆 ${esc(t.name)} <span class="badge badge-${t.status}">${t.status}</span></li>`).join('')}
       </ul>`
    : '<p class="empty">No tournaments yet.</p>';

  document.getElementById('profile-content').innerHTML = `
    <div class="card">
      <div class="profile-info">
        <strong>${esc(user.name)}</strong>
        <span>📧 ${esc(user.email)}</span>
        <span>🎭 Role: <b>${esc(user.role)}</b></span>
        <span>📅 Member since ${esc(user.created_at ? user.created_at.slice(0,10) : '')}</span>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="num">${totalMatches}</div><div class="lbl">Matches</div></div>
        <div class="stat"><div class="num">${Array.isArray(teams) ? teams.length : 0}</div><div class="lbl">Teams</div></div>
        <div class="stat"><div class="num">${Array.isArray(tournaments) ? tournaments.length : 0}</div><div class="lbl">Tournaments</div></div>
      </div>
    </div>

    <div class="section-title">Team Invitations</div>
    ${invHtml}

    <div class="section-title">Match History</div>
    ${matchHtml}

    <div class="section-title">My Teams</div>
    ${teamsHtml}

    ${Array.isArray(tournaments) && tournaments.length ? `<div class="section-title">My Tournaments</div>${tourHtml}` : ''}
  `;
}

async function respondInvite(teamId, playerId, status) {
  const res = await apiFetch(`/teams/${teamId}/players/${playerId}`, 'PATCH', { status });
  if (res.error) return alert(res.error);
  loadProfile();
}

function invBadge(s) {
  return s === 'accepted' ? 'ongoing' : s === 'rejected' ? 'cancelled' : 'upcoming';
}

/* ── Helpers ── */
async function apiFetch(path, method = 'GET', body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${API}${path}`, opts);
    return res.json();
  } catch (e) {
    return { error: 'Cannot reach the server. Is the backend running?' };
  }
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
