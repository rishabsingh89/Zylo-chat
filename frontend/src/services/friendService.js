import api from './api';

const MOCK_FRIENDS_KEY = 'zylo_friends';
const MOCK_REQUESTS_KEY = 'zylo_friend_requests';
const MOCK_BLOCKS_KEY = 'zylo_blocked_users';
const MOCK_PREFS_KEY = 'zylo_chat_preferences';

const isNetworkOrServerError = (err) =>
  !err.response || err.response.status >= 500;

// Local storage mock helpers
const getStored = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
};
const setStored = (key, val) => localStorage.setItem(key, JSON.stringify(val));

export const sendFriendRequest = async ({ friendId, username, email }) => {
  try {
    const { data } = await api.post('/api/friends/request', {
      friend_id: friendId,
      username,
      email,
    });
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const me = JSON.parse(localStorage.getItem('zylo_user') || '{}');
      const reqs = getStored(MOCK_REQUESTS_KEY);
      const newReq = {
        id: `req_${Date.now()}`,
        user_id: me._id || me.id,
        friend_id: friendId,
        status: 'pending',
        sender: me,
        created_at: new Date().toISOString(),
      };
      reqs.push(newReq);
      setStored(MOCK_REQUESTS_KEY, reqs);
      return { message: 'Friend request sent', id: newReq.id, status: 'pending' };
    }
    throw err;
  }
};

export const getFriendRequests = async () => {
  try {
    const { data } = await api.get('/api/friends/requests');
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const me = JSON.parse(localStorage.getItem('zylo_user') || '{}');
      const reqs = getStored(MOCK_REQUESTS_KEY);
      const myId = me._id || me.id;
      return {
        incoming: reqs.filter((r) => r.friend_id === myId && r.status === 'pending'),
        outgoing: reqs.filter((r) => r.user_id === myId && r.status === 'pending'),
      };
    }
    throw err;
  }
};

export const acceptFriendRequest = async (requestId) => {
  try {
    const { data } = await api.post(`/api/friends/accept/${requestId}`);
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const reqs = getStored(MOCK_REQUESTS_KEY);
      const req = reqs.find((r) => r.id === requestId);
      if (req) {
        req.status = 'accepted';
        setStored(MOCK_REQUESTS_KEY, reqs);
        const friends = getStored(MOCK_FRIENDS_KEY);
        if (req.sender && !friends.some((f) => f._id === req.sender._id)) {
          friends.push(req.sender);
          setStored(MOCK_FRIENDS_KEY, friends);
        }
      }
      return { message: 'Friend request accepted' };
    }
    throw err;
  }
};

export const rejectFriendRequest = async (requestId) => {
  try {
    const { data } = await api.post(`/api/friends/reject/${requestId}`);
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      let reqs = getStored(MOCK_REQUESTS_KEY);
      reqs = reqs.filter((r) => r.id !== requestId);
      setStored(MOCK_REQUESTS_KEY, reqs);
      return { message: 'Friend request removed' };
    }
    throw err;
  }
};

export const getFriendsList = async () => {
  try {
    const { data } = await api.get('/api/friends');
    return data.map((u) => ({ ...u, _id: u.id || u._id }));
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      return getStored(MOCK_FRIENDS_KEY);
    }
    throw err;
  }
};

export const removeFriend = async (friendId) => {
  try {
    const { data } = await api.delete(`/api/friends/${friendId}`);
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      let friends = getStored(MOCK_FRIENDS_KEY);
      friends = friends.filter((f) => (f._id || f.id) !== friendId);
      setStored(MOCK_FRIENDS_KEY, friends);
      return { message: 'Friend removed' };
    }
    throw err;
  }
};

export const getFriendshipStatus = async (userId) => {
  try {
    const { data } = await api.get(`/api/friends/status/${userId}`);
    return data.status;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const blocks = getStored(MOCK_BLOCKS_KEY);
      if (blocks.some((b) => (b._id || b.id) === userId)) return 'blocked';
      const friends = getStored(MOCK_FRIENDS_KEY);
      if (friends.some((f) => (f._id || f.id) === userId)) return 'friends';
      return 'none';
    }
    return 'none';
  }
};

export const blockUser = async (userId) => {
  try {
    const { data } = await api.post(`/api/users/block/${userId}`);
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const blocks = getStored(MOCK_BLOCKS_KEY);
      if (!blocks.some((b) => (b._id || b.id) === userId)) {
        blocks.push({ _id: userId, id: userId });
        setStored(MOCK_BLOCKS_KEY, blocks);
      }
      return { message: 'User blocked', blocked: true };
    }
    throw err;
  }
};

export const unblockUser = async (userId) => {
  try {
    const { data } = await api.post(`/api/users/unblock/${userId}`);
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      let blocks = getStored(MOCK_BLOCKS_KEY);
      blocks = blocks.filter((b) => (b._id || b.id) !== userId);
      setStored(MOCK_BLOCKS_KEY, blocks);
      return { message: 'User unblocked', blocked: false };
    }
    throw err;
  }
};

export const getBlockedUsers = async () => {
  try {
    const { data } = await api.get('/api/users/blocked/list');
    return data.map((u) => ({ ...u, _id: u.id || u._id }));
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      return getStored(MOCK_BLOCKS_KEY);
    }
    throw err;
  }
};

export const archiveChat = async (targetUserId) => {
  try {
    const { data } = await api.post(`/api/chats/archive/${targetUserId}`);
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const prefs = getStored(MOCK_PREFS_KEY);
      const existing = prefs.find((p) => p.target_user_id === targetUserId);
      if (existing) existing.is_archived = true;
      else prefs.push({ target_user_id: targetUserId, is_archived: true });
      setStored(MOCK_PREFS_KEY, prefs);
      return { is_archived: true };
    }
    throw err;
  }
};

export const unarchiveChat = async (targetUserId) => {
  try {
    const { data } = await api.post(`/api/chats/unarchive/${targetUserId}`);
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const prefs = getStored(MOCK_PREFS_KEY);
      const existing = prefs.find((p) => p.target_user_id === targetUserId);
      if (existing) existing.is_archived = false;
      setStored(MOCK_PREFS_KEY, prefs);
      return { is_archived: false };
    }
    throw err;
  }
};

export const getChatPreferences = async () => {
  try {
    const { data } = await api.get('/api/chats/preferences');
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      return getStored(MOCK_PREFS_KEY);
    }
    throw err;
  }
};
