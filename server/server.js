const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

// Create a new Express app
const app = express();

// Set up CORS
app.use(cors());

// Set up the SQLite database
const db = new sqlite3.Database('mydatabase.db');

// Define the REST endpoints for the APIs
app.get('/api/users', (req, res) => {
  // Query the users table in the database
  const users = db.all(`SELECT * FROM users`);
  
  // Return the result as JSON
  res.json(users);
});

app.post('/api/events', (req, res) => {
  // Insert a new event into the database
  db.run(`INSERT INTO events (title, description, start_date, end_date) VALUES (?, ?, ?, ?)`, [req.body.title, req.body.description, req.body.startDate, req.body.endDate], (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Failed to insert event');
    } else {
      res.json({ message: 'Event inserted successfully' });
    }
  });
});

app.get('/api/events', (req, res) => {
  // Query the events table in the database
  const events = db.all(`SELECT * FROM events`);
  
  // Return the result as JSON
  res.json(events);
});

app.post('/api/chores', (req, res) => {
  // Insert a new chore into the database
  db.run(`INSERT INTO chores (title, description, due_date) VALUES (?, ?, ?)`, [req.body.title, req.body.description, req.body.dueDate], (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Failed to insert chore');
    } else {
      res.json({ message: 'Chore inserted successfully' });
    }
  });
});

app.get('/api/chores', (req, res) => {
  // Query the chores table in the database
  const chores = db.all(`SELECT * FROM chores`);
  
  // Return the result as JSON
  res.json(chores);
});

app.post('/api/lists', (req, res) => {
  // Insert a new list into the database
  db.run(`INSERT INTO lists (title, description) VALUES (?, ?)`, [req.body.title, req.body.description], (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Failed to insert list');
    } else {
      res.json({ message: 'List inserted successfully' });
    }
  });
});

app.get('/api/lists', (req, res) => {
  // Query the lists table in the database
  const lists = db.all(`SELECT * FROM lists`);
  
  // Return the result as JSON
  res.json(lists);
});

// Start the server on port 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

