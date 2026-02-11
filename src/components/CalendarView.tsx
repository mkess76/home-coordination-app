import React from 'react';
import { useState } from 'react';

type Event = {
  id: string;
  name: string;
  start: Date;
  end: Date;
  userId: string;
};

type User = {
  id: string;
  name: string;
};

function CalendarView(props: { events: Event[]; users: User[]; onEventClick: (event: Event) => void }) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  function handleEventClick(event: Event) {
    setSelectedEvent(event);
    props.onEventClick(event);
  }

  return (
    <div className="calendar-view">
      <h1>Calendar View</h1>
      <div className="grid">
        {props.events.map((event) => (
          <div key={event.id} className="event" onClick={() => handleEventClick(event)}>
            <div className="event-name">{event.name}</div>
            <div className="event-date">
              {event.start.toLocaleDateString()} - {event.end.toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

