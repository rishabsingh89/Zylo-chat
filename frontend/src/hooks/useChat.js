import { useState, useEffect, useCallback, useRef } from 'react';
import { getMessages, sendMessage as sendMessageApi, deleteMessage as deleteMessageApi, clearChat as clearChatApi, updateMessage as updateMessageApi } from '../services/chatService';
import api from '../services/api';
import useAuth from './useAuth';
import { 
  loadPrivateKeyLocally, 
  importPrivateKey, 
  importPublicKey, 
  deriveSharedKey, 
  encryptMessage, 
  decryptMessage 
} from '../services/cryptoService';

const useChat = (selectedUser) => {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef(null);
  const wsRef = useRef(null);

  const targetUserId = selectedUser?._id || selectedUser?.id;

  const sharedKeyRef = useRef(null);

  // Helper to decrypt a list of messages asynchronously
  const decryptMessageList = useCallback(async (msgList, key) => {
    if (!key) return msgList;
    const decrypted = [];
    for (const m of msgList) {
      if (m.is_encrypted && m.iv) {
        try {
          const plain = await decryptMessage(m.content, m.iv, key);
          decrypted.push({ ...m, content: plain });
        } catch (err) {
          console.error("Failed to decrypt message:", err);
          decrypted.push({ ...m, content: "🔒 [Decryption failed]" });
        }
      } else {
        decrypted.push(m);
      }
    }
    return decrypted;
  }, []);

  // Derive shared key whenever selectedUser or targetUserId changes
  useEffect(() => {
    sharedKeyRef.current = null;
    const deriveKeyAsync = async () => {
      const myId = user?.id || user?._id;
      const otherPublicKeyBase64 = selectedUser?.public_key;
      if (!myId || !otherPublicKeyBase64 || !targetUserId) return;

      try {
        const myPrivateKeyBase64 = await loadPrivateKeyLocally(myId);
        if (!myPrivateKeyBase64) return;

        const myPrivateKeyObj = await importPrivateKey(myPrivateKeyBase64);
        const otherPublicKeyObj = await importPublicKey(otherPublicKeyBase64);
        
        sharedKeyRef.current = await deriveSharedKey(myPrivateKeyObj, otherPublicKeyObj);
        console.log("Derived E2EE shared secret key successfully!");

        // Decrypt already loaded messages
        setMessages((prev) => {
          decryptMessageList(prev, sharedKeyRef.current).then((decryptedList) => {
            setMessages(decryptedList);
          });
          return prev;
        });
      } catch (err) {
        console.error("Failed to derive E2EE shared secret:", err);
      }
    };
    deriveKeyAsync();
  }, [targetUserId, selectedUser?.public_key, user, decryptMessageList]);

  // Fetch messages from backend database whenever selectedUser changes
  useEffect(() => {
    if (!targetUserId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    getMessages(targetUserId)
      .then(async (msgs) => {
        if (sharedKeyRef.current) {
          const decrypted = await decryptMessageList(msgs, sharedKeyRef.current);
          setMessages(decrypted);
        } else {
          setMessages(msgs || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load messages from backend:', err);
        setMessages([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [targetUserId, decryptMessageList]);

  // Connect native WebSocket for FastAPI backend
  useEffect(() => {
    if (!token) return;
    const getWsUrl = () => {
      const rawUrl = api.defaults.baseURL || 'http://localhost:8000';
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      if (rawUrl.startsWith('http')) {
        return rawUrl.replace(/^http/, 'ws') + `/ws/chat/${encodeURIComponent(token)}`;
      }
      return `${wsProtocol}://${window.location.host}/ws/chat/${encodeURIComponent(token)}`;
    };

    const wsUrl = getWsUrl();
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
            if (normalized.is_encrypted && normalized.iv && sharedKeyRef.current) {
              decryptMessage(normalized.content, normalized.iv, sharedKeyRef.current)
                .then((plain) => {
                  const decryptedMsg = { ...normalized, content: plain };
                  setMessages((prev) => {
                    if (prev.some((m) => m._id === decryptedMsg._id)) return prev;
                    return [...prev, decryptedMsg];
                  });
                })
                .catch((err) => {
                  console.error("Failed to decrypt incoming WS message:", err);
                  const failMsg = { ...normalized, content: "🔒 [Decryption failed]" };
                  setMessages((prev) => {
                    if (prev.some((m) => m._id === failMsg._id)) return prev;
                    return [...prev, failMsg];
                  });
                });
            } else {
              setMessages((prev) => {
                if (prev.some((m) => m._id === normalized._id)) return prev;
                return [...prev, normalized];
              });
            }
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
        let saved;
        if (sharedKeyRef.current && content.trim()) {
          const encrypted = await encryptMessage(content, sharedKeyRef.current);
          saved = await sendMessageApi({
            receiverId: otherId,
            content: encrypted.ciphertext,
            iv: encrypted.iv,
            is_encrypted: true,
            fileData,
          });
          // Update local state with the decrypted message content so it renders in plaintext for the sender
          const decryptedSaved = { ...saved, content, is_encrypted: true, iv: encrypted.iv };
          setMessages((prev) => prev.map((m) => (m._id === optimistic._id ? decryptedSaved : m)));
        } else {
          saved = await sendMessageApi({
            receiverId: otherId,
            content,
            is_encrypted: false,
            fileData,
          });
          setMessages((prev) => prev.map((m) => (m._id === optimistic._id ? saved : m)));
        }
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

