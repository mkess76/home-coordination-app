const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const oauthStates = new Map();

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/oauth/callback';
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
];
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3001;
const CLIENT_BUILD_PATH = path.resolve(__dirname, '..', 'build');
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', APP_BASE_URL];
const ALLOWED_ORIGINS = [
  ...new Set(
    (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .concat(DEFAULT_ALLOWED_ORIGINS)
  ),
];

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json());

// Database
const db = new sqlite3.Database('./family.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

function runDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function getDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function allDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

async function addColumnIfMissing(columnName, columnDefinition) {
  const columns = await allDb('PRAGMA table_info(events)');
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await runDb(`ALTER TABLE events ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

async function ensureCalendarSchema() {
  await addColumnIfMissing('source', "TEXT NOT NULL DEFAULT 'local'");
  await addColumnIfMissing('google_event_id', 'TEXT');
  await runDb(
    `CREATE TABLE IF NOT EXISTS google_oauth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      email TEXT,
      refresh_token TEXT,
      access_token TEXT,
      access_token_expires_at DATETIME,
      scope TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await runDb(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_events_google_event_id ON events(google_event_id) WHERE google_event_id IS NOT NULL'
  );
}

function getGoogleEvents(accessToken, timeMin, timeMax, calendarId = 'primary') {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      timeMin,
      timeMax,
    });
    const request = https.request(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Google API request failed with status ${response.statusCode}: ${body}`));
            return;
          }

          try {
            const parsed = JSON.parse(body);
            resolve(parsed.items || []);
          } catch (error) {
            reject(new Error(`Could not parse Google API response: ${error.message}`));
          }
        });
      }
    );

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });
}

function mapGoogleEvent(googleEvent) {
  const start = googleEvent.start?.dateTime || googleEvent.start?.date;
  const end = googleEvent.end?.dateTime || googleEvent.end?.date || start;
  const allDay = googleEvent.start?.date && !googleEvent.start?.dateTime ? 1 : 0;
  return {
    google_event_id: googleEvent.id,
    title: googleEvent.summary || '(No title)',
    description: googleEvent.description || null,
    location: googleEvent.location || null,
    start_time: start,
    end_time: end,
    all_day: allDay,
  };
}

function getAuthTokenFromHeader(authorizationHeader) {
  if (!authorizationHeader) return '';
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return '';
  return token.trim();
}

function decodeJwtPayload(jwtToken) {
  if (!jwtToken || !jwtToken.includes('.')) return {};
  try {
    const payload = jwtToken.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (error) {
    return {};
  }
}

function parseGoogleTokenResponse(responsePayload) {
  const payload = responsePayload || {};
  const expiresInSeconds = Number(payload.expires_in || 0);
  const expiresAt = expiresInSeconds > 0 ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : null;
  const profile = decodeJwtPayload(payload.id_token);
  return {
    accessToken: payload.access_token || null,
    refreshToken: payload.refresh_token || null,
    scope: payload.scope || null,
    expiresAt,
    email: profile.email || null,
  };
}

function parseUserId(rawValue, fallbackValue = null) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallbackValue;
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

async function ensureUserExists(userId) {
  const existingUser = await getDb('SELECT id FROM users WHERE id = ?', [userId]);
  return Boolean(existingUser);
}

function postFormEncoded(url, formPayload) {
  return new Promise((resolve, reject) => {
    const formBody = new URLSearchParams(formPayload).toString();
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formBody),
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}: ${body}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${body}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.write(formBody);
    request.end();
  });
}

async function exchangeAuthCodeForTokens(authCode) {
  return postFormEncoded('https://oauth2.googleapis.com/token', {
    code: authCode,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });
}

async function refreshAccessToken(refreshToken) {
  return postFormEncoded('https://oauth2.googleapis.com/token', {
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
}

function buildGoogleAuthUrl(stateToken) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GOOGLE_SCOPES.join(' '),
    state: stateToken,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function upsertGoogleToken(userId, tokenData) {
  const existing = await getDb(
    'SELECT id, refresh_token FROM google_oauth_tokens WHERE user_id = ?',
    [userId]
  );
  const refreshToken = tokenData.refreshToken || existing?.refresh_token || null;
  if (existing) {
    await runDb(
      `UPDATE google_oauth_tokens
       SET email = ?, refresh_token = ?, access_token = ?, access_token_expires_at = ?, scope = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [
        tokenData.email,
        refreshToken,
        tokenData.accessToken,
        tokenData.expiresAt,
        tokenData.scope,
        userId,
      ]
    );
    return;
  }

  await runDb(
    `INSERT INTO google_oauth_tokens
     (user_id, email, refresh_token, access_token, access_token_expires_at, scope)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      tokenData.email,
      refreshToken,
      tokenData.accessToken,
      tokenData.expiresAt,
      tokenData.scope,
    ]
  );
}

function isTokenFresh(expiresAt) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  if (Number.isNaN(time)) return false;
  return time > Date.now() + 60000;
}

async function getStoredGoogleAccessToken(userId) {
  const tokenRow = await getDb(
    `SELECT refresh_token, access_token, access_token_expires_at
     FROM google_oauth_tokens
     WHERE user_id = ?`,
    [userId]
  );
  if (!tokenRow) {
    throw new Error('Google account is not connected for this user');
  }

  if (tokenRow.access_token && isTokenFresh(tokenRow.access_token_expires_at)) {
    return tokenRow.access_token;
  }

  if (!tokenRow.refresh_token) {
    throw new Error('Stored Google token has no refresh token');
  }

  const refreshedPayload = await refreshAccessToken(tokenRow.refresh_token);
  const refreshedTokenData = parseGoogleTokenResponse(refreshedPayload);
  await upsertGoogleToken(userId, {
    ...refreshedTokenData,
    refreshToken: tokenRow.refresh_token,
  });
  if (!refreshedTokenData.accessToken) {
    throw new Error('Could not refresh Google access token');
  }
  return refreshedTokenData.accessToken;
}

async function getAccessTokenForRequest(req, userId) {
  const bearerToken = getAuthTokenFromHeader(req.headers.authorization);
  if (bearerToken) return bearerToken;
  return getStoredGoogleAccessToken(userId);
}

function googleOAuthConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function putOAuthState(userId) {
  const stateToken = crypto.randomBytes(24).toString('hex');
  oauthStates.set(stateToken, {
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return stateToken;
}

function popOAuthState(stateToken) {
  const state = oauthStates.get(stateToken);
  oauthStates.delete(stateToken);
  if (!state || state.expiresAt < Date.now()) return null;
  return state;
}

setInterval(() => {
  const now = Date.now();
  for (const [token, state] of oauthStates.entries()) {
    if (state.expiresAt < now) {
      oauthStates.delete(token);
    }
  }
}, 60 * 1000).unref();

app.get('/api/google/oauth/start', async (req, res) => {
  if (!googleOAuthConfigured()) {
    res.status(500).json({ error: 'Google OAuth is not configured on server' });
    return;
  }

  const userId = parseUserId(req.query.user_id, 1);
  if (!userId) {
    res.status(400).json({ error: 'A valid user_id query parameter is required' });
    return;
  }

  if (!(await ensureUserExists(userId))) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const stateToken = putOAuthState(userId);
  const authUrl = buildGoogleAuthUrl(stateToken);
  res.redirect(authUrl);
});

app.get('/api/google/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code || !state) {
    res.redirect(`${APP_BASE_URL}/?google=error`);
    return;
  }

  if (!googleOAuthConfigured()) {
    res.redirect(`${APP_BASE_URL}/?google=error`);
    return;
  }

  const oauthState = popOAuthState(state);
  if (!oauthState) {
    res.redirect(`${APP_BASE_URL}/?google=error`);
    return;
  }

  try {
    const tokenResponse = await exchangeAuthCodeForTokens(code);
    const tokenData = parseGoogleTokenResponse(tokenResponse);
    await upsertGoogleToken(oauthState.userId, tokenData);
    res.redirect(`${APP_BASE_URL}/?google=connected`);
  } catch (callbackError) {
    console.error('OAuth callback failed:', callbackError.message);
    res.redirect(`${APP_BASE_URL}/?google=error`);
  }
});

app.get('/api/google/oauth/status', async (req, res) => {
  const userId = parseUserId(req.query.user_id, 1);
  if (!userId) {
    res.status(400).json({ error: 'A valid user_id query parameter is required' });
    return;
  }

  try {
    if (!(await ensureUserExists(userId))) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const row = await getDb(
      `SELECT email, refresh_token, access_token, access_token_expires_at
       FROM google_oauth_tokens
       WHERE user_id = ?`,
      [userId]
    );
    if (!row) {
      res.json({ connected: false, email: null });
      return;
    }
    res.json({
      connected: Boolean(row.refresh_token || row.access_token),
      email: row.email || null,
      hasRefreshToken: Boolean(row.refresh_token),
    });
  } catch (statusError) {
    res.status(500).json({ error: statusError.message });
  }
});

app.post('/api/google/oauth/disconnect', async (req, res) => {
  const userId = parseUserId(req.body.user_id, 1);
  if (!userId) {
    res.status(400).json({ error: 'A valid user_id is required' });
    return;
  }

  try {
    if (!(await ensureUserExists(userId))) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await runDb('DELETE FROM google_oauth_tokens WHERE user_id = ?', [userId]);
    res.json({ disconnected: true });
  } catch (disconnectError) {
    res.status(500).json({ error: disconnectError.message });
  }
});

// ===== USERS API =====
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/users', (req, res) => {
  const { name, color, profile_image } = req.body;
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedColor = /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : '#3B82F6';

  if (!normalizedName) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  db.run(
    'INSERT INTO users (name, color, profile_image, role) VALUES (?, ?, ?, ?)',
    [normalizedName, normalizedColor, profile_image || null, 'member'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, name: normalizedName, color: normalizedColor });
      }
    }
  );
});

// ===== EVENTS API =====
app.get('/api/events', (req, res) => {
  db.all('SELECT * FROM events ORDER BY start_time', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/google-calendar/events', async (req, res) => {
  const userId = parseUserId(req.query.user_id, 1);
  const calendarId = req.query.calendarId || 'primary';
  const timeMin = req.query.timeMin || new Date().toISOString();
  const timeMax =
    req.query.timeMax ||
    new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();

  if (!userId) {
    res.status(400).json({ error: 'A valid user_id query parameter is required' });
    return;
  }

  try {
    if (!(await ensureUserExists(userId))) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const accessToken = await getAccessTokenForRequest(req, userId);
    const googleEvents = await getGoogleEvents(accessToken, timeMin, timeMax, calendarId);
    const normalizedEvents = googleEvents.map(mapGoogleEvent);
    res.json(normalizedEvents);
  } catch (error) {
    console.error('Google events fetch failed:', error.message);
    res.status(502).json({ error: 'Failed to fetch events from Google Calendar' });
  }
});

app.post('/api/google-calendar/sync', async (req, res) => {
  const calendarId = req.body.calendarId || 'primary';
  const userId = parseUserId(req.body.user_id, 1);
  const timeMin = req.body.timeMin || new Date().toISOString();
  const timeMax =
    req.body.timeMax ||
    new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();

  if (!userId) {
    res.status(400).json({ error: 'A valid user_id is required' });
    return;
  }

  try {
    if (!(await ensureUserExists(userId))) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const accessToken = await getAccessTokenForRequest(req, userId);
    const googleEvents = await getGoogleEvents(accessToken, timeMin, timeMax, calendarId);
    let imported = 0;
    let updated = 0;

    for (const rawGoogleEvent of googleEvents) {
      if (!rawGoogleEvent.id) {
        continue;
      }

      const event = mapGoogleEvent(rawGoogleEvent);
      const existingEvent = await getDb(
        'SELECT id FROM events WHERE google_event_id = ?',
        [event.google_event_id]
      );

      if (existingEvent) {
        await runDb(
          `UPDATE events
           SET user_id = ?, title = ?, description = ?, start_time = ?, end_time = ?, all_day = ?, location = ?, source = 'google'
           WHERE id = ?`,
          [
            userId,
            event.title,
            event.description,
            event.start_time,
            event.end_time,
            event.all_day,
            event.location,
            existingEvent.id,
          ]
        );
        updated += 1;
      } else {
        await runDb(
          `INSERT INTO events (user_id, title, description, start_time, end_time, all_day, location, source, google_event_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'google', ?)`,
          [
            userId,
            event.title,
            event.description,
            event.start_time,
            event.end_time,
            event.all_day,
            event.location,
            event.google_event_id,
          ]
        );
        imported += 1;
      }
    }

    res.json({
      message: 'Google Calendar sync completed',
      imported,
      updated,
      scanned: googleEvents.length,
    });
  } catch (error) {
    console.error('Google sync failed:', error.message);
    res.status(502).json({ error: 'Google Calendar sync failed' });
  }
});

app.get('/api/events/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.all(
    'SELECT * FROM events WHERE DATE(start_time) = ? ORDER BY start_time',
    [today],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

app.post('/api/events', (req, res) => {
  const { user_id, title, description, start_time, end_time, all_day, location } = req.body;
  db.run(
    'INSERT INTO events (user_id, title, description, start_time, end_time, all_day, location) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user_id, title, description, start_time, end_time, all_day ? 1 : 0, location],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: 'Event created' });
      }
    }
  );
});

// ===== CHORES API =====
app.get('/api/chores', (req, res) => {
  db.all('SELECT * FROM chores ORDER BY due_date', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/chores/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.all(
    'SELECT * FROM chores WHERE DATE(due_date) = ? ORDER BY due_date',
    [today],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

app.post('/api/chores', (req, res) => {
  const { user_id, title, description, due_date, recurring } = req.body;
  db.run(
    'INSERT INTO chores (user_id, title, description, due_date, recurring, completed, stars_earned) VALUES (?, ?, ?, ?, ?, 0, 0)',
    [user_id, title, description, due_date, recurring || 'none'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: 'Chore created' });
      }
    }
  );
});

app.patch('/api/chores/:id/complete', (req, res) => {
  const { id } = req.params;
  db.run(
    'UPDATE chores SET completed = 1, stars_earned = stars_earned + 1 WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Chore completed', changes: this.changes });
      }
    }
  );
});

// ===== LISTS API =====
app.get('/api/lists', (req, res) => {
  db.all('SELECT * FROM lists', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/lists', (req, res) => {
  const { name, type } = req.body;
  db.run(
    'INSERT INTO lists (name, type) VALUES (?, ?)',
    [name, type || 'general'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: 'List created' });
      }
    }
  );
});

app.get('/api/lists/:id/items', (req, res) => {
  const { id } = req.params;
  db.all('SELECT * FROM list_items WHERE list_id = ?', [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/lists/:id/items', (req, res) => {
  const { id } = req.params;
  const { text, added_by } = req.body;
  db.run(
    'INSERT INTO list_items (list_id, text, completed, added_by) VALUES (?, ?, 0, ?)',
    [id, text, added_by],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: 'Item added' });
      }
    }
  );
});

if (fs.existsSync(path.join(CLIENT_BUILD_PATH, 'index.html'))) {
  app.use(express.static(CLIENT_BUILD_PATH));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
  });
}

// Start server
ensureCalendarSchema()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on ${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Schema migration failed:', error.message);
    process.exit(1);
  });
