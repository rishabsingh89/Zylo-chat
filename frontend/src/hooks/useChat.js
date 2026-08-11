import { useState, useEffect, useCallback, useRef } from 'react';
import { getMessages, sendMessage as sendMessageApi, deleteMessage as deleteMessageApi, clearChat as clearChatApi, updateMessage as updateMessageApi } from '../services/chatService';
import { io } from 'socket.io-client';
import useAuth from './useAuth';

const useChat = (selectedUser) => {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef(null);
  const wsRef = useRef(null);

  const targetUserId = selectedUser?._id || selectedUser?.id;

  // Fetch messages from backend database whenever selectedUser changes
  useEffect(() => {
    if (!targetUserId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    getMessages(targetUserId)
      .then((msgs) => {
        setMessages(msgs || []);
      })
      .catch((err) => {
        console.error('Failed to load messages from backend:', err);
        setMessages([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [targetUserId]);

  // Connect native WebSocket for FastAPI backend
  useEffect(() => {
    if (!token) return;
    const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsUrl = rawUrl.replace(/^http/, 'ws') + `/ws/chat/${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          const msg = data.message;
          const normalized = {
            ...msg,
            _id: msg.id || msg._id,
            sender: msg.sender_id || msg.sender,
            receiver: msg.receiver_id || msg.receiver,
          };
          // Only append if it belongs to current active chat
          if (
            (normalized.sender === targetUserId && normalized.receiver === (user?._id || user?.id)) ||
            (normalized.receiver === targetUserId && normalized.sender === (user?._id || user?.id))
          ) {
            setMessages((prev) => {
              if (prev.some((m) => m._id === normalized._id)) return prev;
              return [...prev, normalized];
            });
          }
        } else if (data.type === 'typing_start') {
          if (data.sender_id === targetUserId) setIsTyping(true);
        } else if (data.type === 'typing_stop') {
          if (data.sender_id === targetUserId) setIsTyping(false);
        } else if (data.type === 'message_status') {
          setMessages((prev) =>
            prev.map((m) => (m._id === data.message_id ? { ...m, status: data.status } : m))
          );
        }
      } catch (err) {
        console.error('WS JSON parse error:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [token, targetUserId, user?._id, user?.id]);


  const sendMessage = useCallback(
    async (content, fileData = null) => {
      const myId = user?._id || user?.id;
      const otherId = selectedUser?._id || selectedUser?.id;
      if ((!content.trim() && !fileData) || !otherId) return;

      const optimistic = {
        _id: `opt_${Date.now()}`,
        sender: myId,
        receiver: otherId,
        content,
        ...(fileData || {}),
        createdAt: new Date().toISOString(),
        optimistic: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const saved = await sendMessageApi({
          receiverId: otherId,
          content,
          fileData,
        });
        setMessages((prev) => prev.map((m) => (m._id === optimistic._id ? saved : m)));
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
        throw err;
      }
    },
    [selectedUser, user]
  );

  const removeMessage = useCallback(
    async (messageId) => {
      const otherId = selectedUser?._id || selectedUser?.id;
      if (!otherId) return;
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      try {
        await deleteMessageApi(messageId, otherId);
      } catch (err) {
        console.error(err);
      }
    },
    [selectedUser]
  );

  const clearAllMessages = useCallback(
    async () => {
      const otherId = selectedUser?._id || selectedUser?.id;
      if (!otherId) return;
      setMessages([]);
      try {
        await clearChatApi(otherId);
      } catch (err) {
        console.error(err);
      }
    },
    [selectedUser]
  );

  const editExistingMessage = useCallback(
    async (messageId, newContent) => {
      const otherId = selectedUser?._id || selectedUser?.id;
      if (!otherId) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, content: newContent, edited: true } : m))
      );
      try {
        await updateMessageApi(messageId, otherId, newContent);
      } catch (err) {
        console.error(err);
      }
    },
    [selectedUser]
  );

  return { messages, loading, sendMessage, removeMessage, clearAllMessages, editExistingMessage };
};

export default useChat;

