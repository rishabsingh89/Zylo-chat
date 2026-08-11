import api from './api';

const MOCK_USERS_KEY = 'zylo_mock_users';

const getMockUsers = () => {
  try { return JSON.parse(localStorage.getItem(MOCK_USERS_KEY)) || []; }
  catch { return []; }
};

const isNetworkOrServerError = (err) =>
  !err.response || err.response.status >= 500;

export const searchUsers = async (query) => {
  try {
    const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
    return data.map((u) => ({ ...u, _id: u.id || u._id }));
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      // Mock: search local registered users
      const currentUser = JSON.parse(localStorage.getItem('zylo_user') || 'null');
      const users = getMockUsers();
      const q = query.toLowerCase();
      return users
        .filter((u) => u._id !== currentUser?._id)
        .filter((u) =>
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
