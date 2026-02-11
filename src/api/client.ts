import axios from 'axios';

interface User {
  id: number;
  name: string;
}

interface Event {
  id: number;
  title: string;
  startDate: Date;
  endDate: Date;
}

interface Chore {
  id: number;
  name: string;
}

interface List {
  id: number;
  name: string;
}

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
});

// Fetch users
async function fetchUsers(): Promise<User[]> {
  const response = await api.get('/users');
  return response.data;
}

// Fetch events
async function fetchEvents(): Promise<Event[]> {
  const response = await api.get('/events');
  return response.data;
}

// Fetch chores
async function fetchChores(): Promise<Chore[]> {
  const response = await api.get('/chores');
  return response.data;
}

// Fetch lists
async function fetchLists(): Promise<List[]> {
  const response = await api.get('/lists');
  return response.data;
}

// Create a new user
async function createUser(user: User): Promise<number> {
  const response = await api.post('/users', user);
  return response.data.id;
}

// Update an existing user
async function updateUser(user: User, id: number): Promise<void> {
  await api.put(`/users/${id}`, user);
}

// Delete a user
async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}

// Create a new event
async function createEvent(event: Event): Promise<number> {
  const response = await api.post('/events', event);
  return response.data.id;
}

// Update an existing event
async function updateEvent(event: Event, id: number): Promise<void> {
  await api.put(`/events/${id}`, event);
}

// Delete an event
async function deleteEvent(id: number): Promise<void> {
  await api.delete(`/events/${id}`);
}

// Create a new chore
async function createChore(chore: Chore): Promise<number> {
  const response = await api.post('/chores', chore);
  return response.data.id;
}

// Update an existing chore
async function updateChore(chore: Chore, id: number): Promise<void> {
  await api.put(`/chores/${id}`, chore);
}

// Delete a chore
async function deleteChore(id: number): Promise<void> {
  await api.delete(`/chores/${id}`);
}

// Create a new list
async function createList(list: List): Promise<number> {
  const response = await api.post('/lists', list);
  return response.data.id;
}

// Update an existing list
async function updateList(list: List, id: number): Promise<void> {
  await api.put(`/lists/${id}`, list);
}

// Delete a list
async function deleteList(id: number): Promise<void> {
  await api.delete(`/lists/${id}`);
}

