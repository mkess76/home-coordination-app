// EventService.js
import axios from 'axios';

const API_URL = '/api/events';

const addEvent = async (eventData) => {
  try {
    const response = await axios.post(API_URL, eventData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to add event');
  }
};

export default { addEvent };