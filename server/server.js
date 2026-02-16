const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const https = require('https');

const app = express();

// Middleware
app.use(cors());
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
  db.run(
    'INSERT INTO users (name, color, profile_image, role) VALUES (?, ?, ?, ?)',
    [name, color, profile_image || null, 'member'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, name, color });
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
  const accessToken = getAuthTokenFromHeader(req.headers.authorization);
  if (!accessToken) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const calendarId = req.query.calendarId || 'primary';
  const timeMin = req.query.timeMin || new Date().toISOString();
  const timeMax =
    req.query.timeMax ||
    new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();

  try {
    const googleEvents = await getGoogleEvents(accessToken, timeMin, timeMax, calendarId);
    const normalizedEvents = googleEvents.map(mapGoogleEvent);
    res.json(normalizedEvents);
  } catch (error) {
    console.error('Google events fetch failed:', error.message);
    res.status(502).json({ error: 'Failed to fetch events from Google Calendar' });
  }
});

app.post('/api/google-calendar/sync', async (req, res) => {
  const accessToken = getAuthTokenFromHeader(req.headers.authorization);
  if (!accessToken) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const calendarId = req.body.calendarId || 'primary';
  const userId = Number(req.body.user_id) || 1;
  const timeMin = req.body.timeMin || new Date().toISOString();
  const timeMax =
    req.body.timeMax ||
    new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();

  try {
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

// Start server
const PORT = process.env.PORT || 3001;
ensureCalendarSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Schema migration failed:', error.message);
    process.exit(1);
  });
