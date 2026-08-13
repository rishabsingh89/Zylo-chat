import api from './api';

export const getMessages = async (receiverId) => {
  const { data } = await api.get(`/api/messages/${receiverId}`);
  return data.map((m) => ({
    ...m,
    _id: m.id || m._id,
    sender: m.sender_id || m.sender,
    receiver: m.receiver_id || m.receiver,
  }));
};

export const uploadMedia = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/messages/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const sendMessage = async ({ receiverId, content, fileData, iv, is_encrypted }) => {
  const { data } = await api.post('/api/messages/send', {
    receiver_id: receiverId,
    content,
    iv,
    is_encrypted,
    ...(fileData || {}),
  });
  return {
    ...data,
    _id: data.id || data._id,
    sender: data.sender_id || data.sender,
    receiver: data.receiver_id || data.receiver,
  };
};

export const getConversations = async () => {
  const { data } = await api.get('/api/messages/conversations');
  return data;
};

export const deleteMessage = async (messageId) => {
  const { data } = await api.delete(`/api/messages/${messageId}`);
  return data;
};

export const updateMessage = async (messageId, receiverId, newContent) => {
  const { data } = await api.put(`/api/messages/${messageId}`, { content: newContent });
  return data;
};

export const clearChat = async (receiverId) => {
  const { data } = await api.delete(`/api/messages/clear/${receiverId}`);
  return data;
};

