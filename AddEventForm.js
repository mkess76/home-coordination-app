// AddEventForm.js
import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const AddEventForm = ({ onSubmit }) => {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !startTime || !endTime || !location) {
      setError('All fields are required.');
      return;
    }
    if (endTime <= startTime) {
      setError('End time must be after start time.');
      return;
    }

    onSubmit({ title, startTime, endTime, location });
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div>
        <label>Title:</label>
        <input type='text' value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label>Start Time:</label>
        <DatePicker selected={startTime} onChange={setStartTime} showTimeSelect timeIntervals={15} timeCaption='time' dateFormat='MMMM d, yyyy h:mm aa' required />
      </div>
      <div>
        <label>End Time:</label>
        <DatePicker selected={endTime} onChange={setEndTime} showTimeSelect timeIntervals={15} timeCaption='time' dateFormat='MMMM d, yyyy h:mm aa' required />
      </div>
      <div>
        <label>Location:</label>
        <input type='text' value={location} onChange={(e) => setLocation(e.target.value)} required />
      </div>
      <button type='submit'>Submit</button>
    </form>
  );
};

export default AddEventForm;