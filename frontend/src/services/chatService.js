/**
 * chatService.js
 * Real API first, localStorage mock fallback when backend is offline.
 */
import api from './api';

/* ─────────────────────────────────────────
   MOCK MESSAGE STORE (localStorage)
───────────────────────────────────────── */
const msgKey = (a, b) => `zylo_msgs_${[a, b].sort().join('_')}`;

const getMockMessages = (myId, otherId) => {
  try { return JSON.parse(localStorage.getItem(msgKey(myId, otherId))) || []; }
  catch { return []; }
};

const saveMockMessage = (msg, myId, otherId) => {
  const key  = msgKey(myId, otherId);
  const msgs = getMockMessages(myId, otherId);
  msgs.push(msg);
  localStorage.setItem(key, JSON.stringify(msgs));

  // Also update conversations list
  updateMockConversation(myId, otherId, msg);
  return msg;
};

const convoKey = (id) => `zylo_convos_${id}`;

const updateMockConversation = (myId, otherId, lastMsg) => {
  const key   = convoKey(myId);
  let convos  = [];
  try { convos = JSON.parse(localStorage.getItem(key)) || []; } catch { convos = []; }

  const idx = convos.findIndex((c) => c.userId === otherId);
  const entry = { userId: otherId, lastMessage: lastMsg };
  if (idx >= 0) convos[idx] = entry;
  else convos.unshift(entry);
  localStorage.setItem(key, JSON.stringify(convos));
};

const isNetworkOrServerError = (err) =>
  !err.response || err.response.status >= 500;

/* ─────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────── */
export const getMessages = async (receiverId) => {
  const me = JSON.parse(localStorage.getItem('zylo_user') || 'null');
  try {
    const { data } = await api.get(`/api/messages/${receiverId}`);
    return data.map((m) => ({
      ...m,
      _id: m.id || m._id,
      sender: m.sender_id || m.sender,
      receiver: m.receiver_id || m.receiver,
    }));
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      return getMockMessages(me?._id || me?.id, receiverId);
    }
    throw err;
  }
};

export const uploadMedia = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/messages/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const sendMessage = async ({ receiverId, content, fileData }) => {
  const me = JSON.parse(localStorage.getItem('zylo_user') || 'null');
  try {
    const { data } = await api.post('/api/messages/send', {
      receiver_id: receiverId,
      content,
      ...(fileData || {}),
    });
    return {
      ...data,
      _id: data.id || data._id,
      sender: data.sender_id || data.sender,
      receiver: data.receiver_id || data.receiver,
    };
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const msg = {
        _id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        sender: me?._id || me?.id,
        receiver: receiverId,
        content,
        ...(fileData || {}),
        createdAt: new Date().toISOString(),
      };
      return saveMockMessage(msg, me?._id || me?.id, receiverId);
    }
    throw err;
  }
};

export const getConversations = async () => {
  const me = JSON.parse(localStorage.getItem('zylo_user') || 'null');
  try {
    const { data } = await api.get('/api/messages/conversations');
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const key = convoKey(me?._id);
      let convos = [];
      try { convos = JSON.parse(localStorage.getItem(key)) || []; } catch { convos = []; }

      // Resolve user objects from mock user store
      const MOCK_USERS_KEY = 'zylo_mock_users';
      let users = [];
      try { users = JSON.parse(localStorage.getItem(MOCK_USERS_KEY)) || []; } catch { users = []; }

      return convos
        .map((c) => {
          const u = users.find((u) => u._id === c.userId);
          if (!u) return null;
          const { password: _, ...safe } = u;
          return { user: safe, lastMessage: c.lastMessage };
        })
        .filter(Boolean);
    }
    throw err;
  }
};

export const deleteMessage = async (messageId, receiverId) => {
  const me = JSON.parse(localStorage.getItem('zylo_user') || 'null');
  try {
    const { data } = await api.delete(`/api/messages/${messageId}`);
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const key = msgKey(me?._id, receiverId);
      let msgs = getMockMessages(me?._id, receiverId);
      msgs = msgs.filter((m) => m._id !== messageId);
      localStorage.setItem(key, JSON.stringify(msgs));
      return { success: true };
    }
    throw err;
  }
};

export const updateMessage = async (messageId, receiverId, newContent) => {
  const me = JSON.parse(localStorage.getItem('zylo_user') || 'null');
  try {
    const { data } = await api.put(`/api/messages/${messageId}`, { content: newContent });
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const key = msgKey(me?._id, receiverId);
      let msgs = getMockMessages(me?._id, receiverId);
      msgs = msgs.map((m) => (m._id === messageId ? { ...m, content: newContent, edited: true } : m));
      localStorage.setItem(key, JSON.stringify(msgs));
      return { success: true };
    }
    throw err;
  }
};

export const clearChat = async (receiverId) => {
  const me = JSON.parse(localStorage.getItem('zylo_user') || 'null');
  try {
    const { data } = await api.delete(`/api/messages/clear/${receiverId}`);
    return data;
  } catch (err) {
    if (isNetworkOrServerError(err)) {
      const key = msgKey(me?._id, receiverId);
      localStorage.setItem(key, JSON.stringify([]));
      return { success: true };
    }
    throw err;
  }
};
