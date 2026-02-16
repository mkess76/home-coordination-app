Home Coordination App
=======================

A comprehensive home management app to organize your daily activities, schedules, chores, and weather information all in one place.

Features
--------
- Calendar: Manage your schedule effectively with a user-friendly calendar interface.
- Google Calendar Integration: Connect and sync your Google Calendar events into the app.
- Chores: Assign, track, and complete household tasks efficiently.
- Lists: Create and manage multiple lists for grocery shopping, to-dos, or any other items you need to keep track of.
- Weather: Stay updated on the latest weather forecasts for your location.

Tech Stack
----------
The Home Coordination App is built using the following technologies:
- Frontend: React
- Backend: Node.js
- Database: SQLite

Installation
------------
To get started with the Home Coordination App, follow these steps:

1. Clone the repository: `git clone https://github.com/YOUR_GITHUB_USERNAME/home-coordination-app.git`
2. Navigate to the project directory: `cd home-coordination-app`
3. Install dependencies:
   - Frontend: `npm install`
   - Backend: `cd server && npm install`
4. Configure Google Calendar (optional but recommended):
   - Create an OAuth Web client in Google Cloud and enable Google Calendar API.
   - Add `http://localhost:3000` as an authorized JavaScript origin.
   - Add `http://localhost:3001/api/google/oauth/callback` as an authorized redirect URI.
   - In the root project folder, create `.env` with:
     - `REACT_APP_GOOGLE_CLIENT_ID=your_google_oauth_client_id`
     - `GOOGLE_CLIENT_ID=your_google_oauth_client_id`
     - `GOOGLE_CLIENT_SECRET=your_google_client_secret`
     - `GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/oauth/callback`
     - `APP_BASE_URL=http://localhost:3000`
     - `ALLOWED_ORIGINS=http://localhost:3000`
5. Start the app:
   - Backend: `cd server && npm start`
   - Frontend (new terminal): `npm start`

Production Deployment (`home.rancherlab.org`)
---------------------------------------------
- Build and run the included Docker image (single container serves both API and frontend):
  - `docker build -t home-coordination-app .`
  - `docker run -p 3001:3001 --env-file .env home-coordination-app`
- Set production env values:
  - `APP_BASE_URL=https://home.rancherlab.org`
  - `GOOGLE_REDIRECT_URI=https://home.rancherlab.org/api/google/oauth/callback`
  - `ALLOWED_ORIGINS=https://home.rancherlab.org`
- In Google Cloud OAuth settings, add:
  - Authorized JavaScript origin: `https://home.rancherlab.org`
  - Authorized redirect URI: `https://home.rancherlab.org/api/google/oauth/callback`
- In Rancher/Ingress, route `https://home.rancherlab.org` to container port `3001`.

Usage Guide
-----------
Once the app is up and running, you can access it via your web browser at `http://localhost:3000`.

To begin using the Home Coordination App, simply navigate through the different sections (Calendar, Chores, Lists, Weather) to manage your daily activities effectively.

API Documentation Overview
---------------------------
The Home Coordination App provides an API for custom integrations and automation. You can find detailed documentation on how to interact with our APIs within the `server` directory of this repository.

Google Calendar Endpoints
-------------------------
- `GET /api/google/oauth/start?user_id=1`:
  - Starts the server-side Google OAuth authorization-code flow.
- `GET /api/google/oauth/callback`:
  - OAuth callback endpoint used by Google.
- `GET /api/google/oauth/status?user_id=1`:
  - Returns whether Google Calendar is connected for the selected user.
- `POST /api/google/oauth/disconnect`:
  - Body: `{ "user_id": 1 }`
  - Removes stored Google tokens for that user.
- `GET /api/google-calendar/events`:
  - Uses stored OAuth token by `user_id` query parameter (or bearer token fallback).
  - Returns normalized Google events.
- `POST /api/google-calendar/sync`:
  - Uses stored OAuth token by `user_id`.
  - Imports and updates Google events into local SQLite `events` table.
  - Optional body fields: `calendarId`, `timeMin`, `timeMax`, `user_id`

Contributing Guidelines
------------------------
We welcome contributions from the open-source community! If you'd like to contribute, please follow these guidelines:

1. Fork this repository and create a new branch for your changes.
2. Make sure to write clear and concise commit messages that accurately describe the changes you made.
3. Follow our coding style and naming conventions to ensure consistency within the codebase.
4. Submit a pull request describing your changes and any relevant information about the implementation.
5. We'll review your contribution and provide feedback if necessary before merging it into the main branch.
