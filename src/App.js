import React, { useState, useEffect } from 'react';

function App() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [chores, setChores] = useState([]);

  useEffect(() => {
    // Fetch data from backend
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Error fetching users:', err));

    fetch('/api/events')
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(err => console.error('Error fetching events:', err));

    fetch('/api/chores')
      .then(res => res.json())
      .then(data => setChores(data))
      .catch(err => console.error('Error fetching chores:', err));
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ color: 'white', textAlign: 'center', fontSize: '3em', marginBottom: '30px' }}>
          🏠 Home Coordination
        </h1>

        {/* Family Members */}
        <div style={{ 
          background: 'white', 
          borderRadius: '15px', 
          padding: '20px', 
          marginBottom: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <h2 style={{ marginTop: 0 }}>👨‍👩‍👧‍👦 Family Members</h2>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {users.map(user => (
              <div key={user.id} style={{
                background: user.color,
                color: 'white',
                padding: '15px 25px',
                borderRadius: '25px',
                fontWeight: 'bold',
                fontSize: '1.1em'
              }}>
                {user.name}
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div style={{ 
          background: 'white', 
          borderRadius: '15px', 
          padding: '20px', 
          marginBottom: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <h2 style={{ marginTop: 0 }}>📅 Upcoming Events</h2>
          {events.map(event => {
            const user = users.find(u => u.id === event.user_id);
            return (
              <div key={event.id} style={{
                borderLeft: `4px solid ${user?.color || '#ccc'}`,
                padding: '15px',
                marginBottom: '10px',
                background: '#f8f9fa',
                borderRadius: '5px'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{event.title}</div>
                <div style={{ color: '#666', marginTop: '5px' }}>
                  {new Date(event.start_time).toLocaleString()}
                </div>
                <div style={{ 
                  color: user?.color || '#666', 
                  fontWeight: 'bold',
                  marginTop: '5px'
                }}>
                  {user?.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* Chores */}
        <div style={{ 
          background: 'white', 
          borderRadius: '15px', 
          padding: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <h2 style={{ marginTop: 0 }}>✅ Chores</h2>
          {chores.map(chore => {
            const user = users.find(u => u.id === chore.user_id);
            return (
              <div key={chore.id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '15px',
                marginBottom: '10px',
                background: '#f8f9fa',
                borderRadius: '5px',
                borderLeft: `4px solid ${user?.color || '#ccc'}`
              }}>
                <input 
                  type="checkbox" 
                  checked={chore.completed === 1}
                  style={{ 
                    width: '25px', 
                    height: '25px', 
                    marginRight: '15px',
                    cursor: 'pointer'
                  }}
                  readOnly
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                    {chore.title}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.9em' }}>
                    {user?.name} • {chore.due_date}
                    {chore.recurring !== 'none' && ` • ${chore.recurring}`}
                  </div>
                </div>
                {chore.stars_earned > 0 && (
                  <div style={{ fontSize: '1.5em' }}>
                    {'⭐'.repeat(chore.stars_earned)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
