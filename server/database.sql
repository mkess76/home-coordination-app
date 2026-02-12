-- Home Coordination App Database Schema

-- Users (Family Members)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  profile_image TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Events (Calendar)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  all_day INTEGER DEFAULT 0,
  location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chores
CREATE TABLE IF NOT EXISTS chores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  recurring TEXT DEFAULT 'none',
  completed INTEGER DEFAULT 0,
  stars_earned INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Lists
CREATE TABLE IF NOT EXISTS lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- List Items
CREATE TABLE IF NOT EXISTS list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  added_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Sample Data
INSERT INTO users (name, color, role) VALUES 
  ('Mom', '#EC4899', 'admin'),
  ('Dad', '#3B82F6', 'admin'),
  ('Alex', '#10B981', 'member'),
  ('Emma', '#F59E0B', 'member');

INSERT INTO events (user_id, title, start_time, all_day) VALUES
  (1, 'Doctor Appointment', datetime('now', '+2 days', '10:00'), 0),
  (3, 'Soccer Practice', datetime('now', '+1 day', '16:00'), 0),
  (4, 'Piano Lesson', datetime('now', '+3 days', '15:30'), 0);

INSERT INTO chores (user_id, title, due_date, recurring) VALUES
  (3, 'Clean Room', date('now'), 'daily'),
  (4, 'Feed Dog', date('now'), 'daily'),
  (1, 'Grocery Shopping', date('now', '+1 day'), 'weekly');

INSERT INTO lists (name, type) VALUES
  ('Grocery List', 'grocery'),
  ('To-Do Today', 'todo');

INSERT INTO list_items (list_id, text, added_by) VALUES
  (1, 'Milk', 1),
  (1, 'Eggs', 1),
  (1, 'Bread', 2),
  (2, 'Call dentist', 1),
  (2, 'Pick up dry cleaning', 2);
