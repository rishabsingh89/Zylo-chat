import api from './api';

export const sendFriendRequest = async ({ friendId, username, email }) => {
  const { data } = await api.post('/api/friends/request', {
    friend_id: friendId,
    username,
    email,
  });
  return data;
};

export const getFriendRequests = async () => {
  const { data } = await api.get('/api/friends/requests');
  return data;
};

export const acceptFriendRequest = async (requestId) => {
  const { data } = await api.post(`/api/friends/accept/${requestId}`);
  return data;
};

export const rejectFriendRequest = async (requestId) => {
  const { data } = await api.post(`/api/friends/reject/${requestId}`);
  return data;
};

export const getFriendsList = async () => {
  const { data } = await api.get('/api/friends');
  return data.map((u) => ({ ...u, _id: u.id || u._id }));
};

export const removeFriend = async (friendId) => {
  const { data } = await api.delete(`/api/friends/${friendId}`);
  return data;
};

export const getFriendshipStatus = async (userId) => {
  try {
    const { data } = await api.get(`/api/friends/status/${userId}`);
    return data.status;
  } catch {
    return 'none';
  }
};

export const blockUser = async (userId) => {
  const { data } = await api.post(`/api/users/block/${userId}`);
  return data;
};

export const unblockUser = async (userId) => {
  const { data } = await api.post(`/api/users/unblock/${userId}`);
  return data;
};

export const getBlockedUsers = async () => {
  const { data } = await api.get('/api/users/blocked/list');
  return data.map((u) => ({ ...u, _id: u.id || u._id }));
};

export const archiveChat = async (targetUserId) => {
  const { data } = await api.post(`/api/chats/archive/${targetUserId}`);
  return data;
};

export const unarchiveChat = async (targetUserId) => {
  const { data } = await api.post(`/api/chats/unarchive/${targetUserId}`);
  return data;
};

export const getChatPreferences = async () => {
  const { data } = await api.get('/api/chats/preferences');
  return data;
};

