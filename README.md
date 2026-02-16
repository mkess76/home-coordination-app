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
   - Create an OAuth Web client in Google Cloud.
   - Add `http://localhost:3000` as an authorized JavaScript origin.
   - In the root project folder, create `.env` with:
     - `REACT_APP_GOOGLE_CLIENT_ID=your_google_oauth_client_id`
5. Start the app:
   - Backend: `cd server && npm start`
   - Frontend (new terminal): `npm start`

Usage Guide
-----------
Once the app is up and running, you can access it via your web browser at `http://localhost:3000`.

To begin using the Home Coordination App, simply navigate through the different sections (Calendar, Chores, Lists, Weather) to manage your daily activities effectively.

API Documentation Overview
---------------------------
The Home Coordination App provides an API for custom integrations and automation. You can find detailed documentation on how to interact with our APIs within the `server` directory of this repository.

Google Calendar Endpoints
-------------------------
- `GET /api/google-calendar/events`:
  - Requires `Authorization: Bearer <google_access_token>`
  - Returns normalized Google events (read-only fetch).
- `POST /api/google-calendar/sync`:
  - Requires `Authorization: Bearer <google_access_token>`
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
