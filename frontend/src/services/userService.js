import api from './api';

export const searchUsers = async (query) => {
  try {
    const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(query || '')}`);
    return data.map((u) => ({ ...u, _id: u.id || u._id }));
  } catch (err) {
    console.error('Error searching users:', err);
    return [];
  }
};

export const getUserById = async (userId) => {
  const { data } = await api.get(`/api/users/${userId}`);
  return { ...data, _id: data.id || data._id };
};

