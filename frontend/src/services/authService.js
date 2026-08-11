/**
 * authService.js
 * 
 * Tries the real backend first. If backend is not running,
 * falls back to a localStorage-based mock auth (frontend demo mode).
 */
import api from './api';

/* ─────────────────────────────────────────────
   MOCK AUTH HELPERS  (localStorage store)
───────────────────────────────────────────── */
const MOCK_USERS_KEY = 'zylo_mock_users';

const DEFAULT_MOCK_USERS = [
  {
    _id: 'mock_seed_1',
    username: 'alex_rivera',
    email: 'alex@zylo.com',
    password: 'password123',
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'mock_seed_2',
    username: 'sarah_chen',
    email: 'sarah@zylo.com',
    password: 'password123',
    createdAt: new Date().toISOString(),
  },
];

const getMockUsers = () => {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (!raw) {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(DEFAULT_MOCK_USERS));
      return DEFAULT_MOCK_USERS;
    }
    const users = JSON.parse(raw);
    return Array.isArray(users) && users.length > 0 ? users : DEFAULT_MOCK_USERS;
  } catch {
    return DEFAULT_MOCK_USERS;
  }
};

const saveMockUsers = (users) =>
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));

const makeFakeToken = (userId) =>
  btoa(`mock_${userId}_${Date.now()}`);

const mockRegister = ({ username, email, password }) => {
  const users = getMockUsers();
  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim().toLowerCase();

  const existingEmailUser = users.find(
    (u) => u.email.trim().toLowerCase() === trimmedEmail
  );
  if (existingEmailUser) {
    return Promise.reject({
      response: { data: { message: 'Email already registered. Please sign in.' } },
    });
  }

  const existingUsernameUser = users.find(
    (u) => u.username.trim().toLowerCase() === trimmedUsername.toLowerCase()
  );
  if (existingUsernameUser) {
    return Promise.reject({
      response: { data: { message: 'Username already taken. Please choose another.' } },
    });
  }

  const newUser = {
    _id: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    username: trimmedUsername,
    email: trimmedEmail,
    password,               // plain text for mock/demo mode
    createdAt: new Date().toISOString(),
  };
  saveMockUsers([...users, newUser]);

  const token = makeFakeToken(newUser._id);
  const { password: _, ...safeUser } = newUser;
  return Promise.resolve({ user: safeUser, token });
};

const mockLogin = ({ email, password }) => {
  const users = getMockUsers();
  const trimmedEmail = email.trim().toLowerCase();
  const user = users.find(
    (u) => u.email.trim().toLowerCase() === trimmedEmail
  );

  if (!user) {
    return Promise.reject({
      response: { data: { message: 'No account found with this email. Please register first.' } },
    });
  }
  if (user.password !== password) {
    return Promise.reject({
      response: { data: { message: 'Incorrect password. Please try again.' } },
    });
  }

  const token = makeFakeToken(user._id);
  const { password: _, ...safeUser } = user;
  return Promise.resolve({ user: safeUser, token });
};

/* ─────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────── */
const isNetworkOrServerError = (err) =>
  !err.response || err.response.status >= 500;

export const registerUser = async ({ username, email, password }) => {
  try {
    const { data } = await api.post('/api/auth/register', { username, email, password });
    const userObj = { ...data.user, _id: data.user.id };
    return { token: data.access_token, user: userObj };
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      return mockRegister({ username, email, password });
    }
    throw err;
  }
};

export const loginUser = async ({ email, password }) => {
  try {
    const { data } = await api.post('/api/auth/login', { email, password });
    const userObj = { ...data.user, _id: data.user.id };
    return { token: data.access_token, user: userObj };
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      return mockLogin({ email, password });
    }
    throw err;
  }
};

export const logoutUser = () => {
  localStorage.removeItem('zylo_token');
  localStorage.removeItem('zylo_user');
};
