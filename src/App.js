import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

function formatDate(dateValue) {
  if (!dateValue) return 'No date';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return 'Invalid date';
  return parsed.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnly(dateValue) {
  if (!dateValue) return 'No due date';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function App() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [chores, setChores] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Local data loaded');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const activeUserId = useMemo(() => users[0]?.id || 1, [users]);

  const fetchHomeData = async () => {
    try {
      const [usersResponse, eventsResponse, choresResponse] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/events'),
        fetch('/api/chores'),
      ]);

      if (!usersResponse.ok || !eventsResponse.ok || !choresResponse.ok) {
        throw new Error('Could not load one or more API endpoints');
      }

      const [usersData, eventsData, choresData] = await Promise.all([
        usersResponse.json(),
        eventsResponse.json(),
        choresResponse.json(),
      ]);

      setUsers(usersData);
      setEvents(eventsData);
      setChores(choresData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setStatusMessage('Failed to load all data from server');
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('google');
    if (authStatus === 'connected') {
      setStatusMessage('Google Calendar connected');
    } else if (authStatus === 'error') {
      setStatusMessage('Google authentication failed');
    }
    if (authStatus) {
      params.delete('google');
      const query = params.toString();
      const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      window.history.replaceState({}, '', nextUrl);
    }
  }, []);

  useEffect(() => {
    if (!activeUserId) return;
    const fetchGoogleStatus = async () => {
      try {
        const response = await fetch(`/api/google/oauth/status?user_id=${activeUserId}`);
        if (!response.ok) {
          throw new Error('Google status endpoint failed');
        }
        const payload = await response.json();
        setGoogleConnected(Boolean(payload.connected));
        setGoogleEmail(payload.email || '');
      } catch (error) {
        console.error('Failed to fetch Google OAuth status:', error);
      }
    };

    fetchGoogleStatus();
  }, [activeUserId]);

  const handleConnectGoogle = () => {
    window.location.assign(`/api/google/oauth/start?user_id=${activeUserId}`);
  };

  const handleSyncGoogleCalendar = async () => {
    if (!googleConnected) {
      setStatusMessage('Connect Google Calendar first');
      return;
    }

    setIsSyncing(true);
    try {
      const syncResponse = await fetch('/api/google-calendar/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: activeUserId }),
      });

      if (!syncResponse.ok) {
        throw new Error('Sync request failed');
      }

      const result = await syncResponse.json();
      await fetchHomeData();
      setStatusMessage(`Google sync complete: ${result.imported} imported, ${result.updated} updated`);
    } catch (error) {
      console.error('Google sync failed:', error);
      setStatusMessage('Google Calendar sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const userMap = useMemo(
    () =>
      users.reduce((accumulator, user) => {
        accumulator[user.id] = user;
        return accumulator;
      }, {}),
    [users]
  );

  const upcomingEvents = useMemo(() => {
    return [...events]
      .sort((first, second) => new Date(first.start_time).getTime() - new Date(second.start_time).getTime())
      .slice(0, 12);
  }, [events]);

  const pendingChores = useMemo(() => chores.filter((chore) => chore.completed !== 1), [chores]);

  return (
    <div className="app-shell">
      <div className="background-art" aria-hidden="true" />
      <main className="dashboard">
        <header className="hero-card">
          <div>
            <p className="eyebrow">HOME COORDINATION</p>
            <h1>Family Command Center</h1>
            <p className="subtitle">Track schedules, chores, and Google Calendar events in one place.</p>
          </div>
          <div className="hero-actions">
            <button className="btn btn-secondary" onClick={handleConnectGoogle}>
              {googleConnected ? 'Reconnect Google' : 'Connect Google Calendar'}
            </button>
            <button className="btn btn-primary" onClick={handleSyncGoogleCalendar} disabled={isSyncing || !googleConnected}>
              {isSyncing ? 'Syncing...' : 'Sync Next 30 Days'}
            </button>
            <p className="status-line">{statusMessage}</p>
            {googleConnected && googleEmail ? <p className="status-line">Connected as {googleEmail}</p> : null}
          </div>
        </header>

        <section className="stats-grid">
          <article className="stat-card">
            <p>Family Members</p>
            <h2>{users.length}</h2>
          </article>
          <article className="stat-card">
            <p>Upcoming Events</p>
            <h2>{upcomingEvents.length}</h2>
          </article>
          <article className="stat-card">
            <p>Pending Chores</p>
            <h2>{pendingChores.length}</h2>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel-card">
            <h3>Family</h3>
            <div className="chips">
              {users.map((user) => (
                <span key={user.id} className="chip" style={{ '--chip-color': user.color }}>
                  {user.name}
                </span>
              ))}
            </div>
          </article>

          <article className="panel-card">
            <h3>Upcoming Events</h3>
            <div className="list">
              {upcomingEvents.map((event) => {
                const user = userMap[event.user_id];
                const isGoogleEvent = event.source === 'google';
                return (
                  <div className="list-item event-item" key={event.id}>
                    <div className="event-dot" style={{ '--dot-color': user?.color || '#3a5075' }} />
                    <div className="list-main">
                      <div className="list-top-line">
                        <strong>{event.title}</strong>
                        {isGoogleEvent ? <span className="tag">Google</span> : <span className="tag local">Local</span>}
                      </div>
                      <p>{formatDate(event.start_time)}</p>
                      <p className="muted">
                        {user?.name || 'Unassigned'}
                        {event.location ? ` • ${event.location}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel-card">
            <h3>Chores</h3>
            <div className="list">
              {chores.map((chore) => {
                const user = userMap[chore.user_id];
                return (
                  <div className={`list-item chore-item ${chore.completed === 1 ? 'is-complete' : ''}`} key={chore.id}>
                    <input type="checkbox" checked={chore.completed === 1} readOnly />
                    <div className="list-main">
                      <strong>{chore.title}</strong>
                      <p className="muted">
                        {user?.name || 'Unassigned'} • {formatDateOnly(chore.due_date)}
                        {chore.recurring && chore.recurring !== 'none' ? ` • ${chore.recurring}` : ''}
                      </p>
                    </div>
                    {chore.stars_earned > 0 ? <span className="stars">{'*'.repeat(chore.stars_earned)}</span> : null}
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;
