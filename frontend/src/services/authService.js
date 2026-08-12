import api from './api';

export const registerUser = async ({ name, username, email, password }) => {
  const { data } = await api.post('/api/auth/register', { name, username, email, password });
  const userObj = { ...data.user, _id: data.user.id };
  return { token: data.access_token, user: userObj };
};


export const loginUser = async ({ email, password }) => {
  const { data } = await api.post('/api/auth/login', { email, password });
  const userObj = { ...data.user, _id: data.user.id };
  return { token: data.access_token, user: userObj };
};

export const logoutUser = () => {
  localStorage.removeItem('zylo_token');
  localStorage.removeItem('zylo_user');
};

