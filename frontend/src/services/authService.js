import api from './api';
import { generateKeyPair, savePrivateKeyLocally, loadPrivateKeyLocally } from './cryptoService';

const syncUserKeys = async (userObj, token) => {
  try {
    const existing = await loadPrivateKeyLocally(userObj.id);
    if (!existing) {
      const keys = await generateKeyPair();
      await savePrivateKeyLocally(userObj.id, keys.privateKey);
      
      // Upload public key to backend
      const { data } = await api.put(
        '/api/users/public-key',
        { public_key: keys.publicKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      userObj.public_key = data.public_key;
    }
  } catch (err) {
    console.error('Failed to sync crypto keys:', err);
  }
};

export const registerUser = async ({ name, username, email, password }) => {
  const { data } = await api.post('/api/auth/register', { name, username, email, password });
  const userObj = { ...data.user, _id: data.user.id };
  await syncUserKeys(userObj, data.access_token);
  return { token: data.access_token, user: userObj };
};


export const loginUser = async ({ email, password }) => {
  const { data } = await api.post('/api/auth/login', { email, password });
  const userObj = { ...data.user, _id: data.user.id };
  await syncUserKeys(userObj, data.access_token);
  return { token: data.access_token, user: userObj };
};

export const logoutUser = () => {
  localStorage.removeItem('zylo_token');
  localStorage.removeItem('zylo_user');
};

