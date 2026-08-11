import api from './api';

const MOCK_USERS_KEY = 'zylo_mock_users';

const DEFAULT_SEED_USERS = [
  { _id: 'mock_seed_thomas_1', username: 'thomas', email: 'thomas@zylo.com' },
  { _id: 'mock_seed_thomas_2', username: 'thomas_wright', email: 'thomas.wright@zylo.com' },
  { _id: 'mock_seed_1', username: 'alex_rivera', email: 'alex@zylo.com' },
  { _id: 'mock_seed_2', username: 'sarah_chen', email: 'sarah@zylo.com' },
  { _id: 'mock_seed_3', username: 'emma_watson', email: 'emma@zylo.com' },
  { _id: 'mock_seed_4', username: 'david_miller', email: 'david@zylo.com' },
];

const getMockUsers = () => {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    let users = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(users) || users.length === 0) {
      users = DEFAULT_SEED_USERS;
    }
    return users;
  } catch {
    return DEFAULT_SEED_USERS;
  }
};

const isFallbackError = (err) =>
  !err.response || err.response.status >= 400;

export const searchUsers = async (query) => {
  try {
    const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
    return data.map((u) => ({ ...u, _id: u.id || u._id }));
  } catch (err) {
    if (isFallbackError(err)) {
      // Mock: search local registered & seed users
      const currentUser = JSON.parse(localStorage.getItem('zylo_user') || 'null');
      const myId = currentUser?._id || currentUser?.id;
      const users = getMockUsers();
      const q = (query || '').toLowerCase().trim();
      return users
        .map((u) => ({ ...u, _id: u._id || u.id }))
        .filter((u) => (u._id || u.id) !== myId)
        .filter((u) =>
          !q ||
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        )
        .map(({ password: _, ...safe }) => safe);
    }
    throw err;
  }
};

export const getUserById = async (userId) => {
  try {
    const { data } = await api.get(`/api/users/${userId}`);
    return { ...data, _id: data.id || data._id };
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const users = getMockUsers();
      const u = users.find((u) => u._id === userId);
      if (!u) throw new Error('User not found');
      const { password: _, ...safe } = u;
      return safe;
    }
    throw err;
  }
};
