const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

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
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
