import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import MessageBubble from './MessageBubble';
import useChat from '../hooks/useChat';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  blockUser,
  unblockUser,
  archiveChat,
  unarchiveChat,
  getFriendshipStatus,
  sendFriendRequest,
  getChatPreferences
} from '../services/friendService';

const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const groupByDate = (messages) => {
  const groups = {};
  messages.forEach((msg) => {
    const dateKey = new Date(msg.createdAt).toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
  });
  return groups;
};

/* ── Icons ── */
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);

const EmojiIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
    <line x1="9" y1="9" x2="9.01" y2="9"/>
    <line x1="15" y1="9" x2="15.01" y2="9"/>
  </svg>
);

const AttachIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);

/* ═══════════════════════════════════════════════
   INLINE MESSAGE INPUT
═══════════════════════════════════════════════ */
const InlineInput = ({ onSend, disabled, placeholder }) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const handleSend = () => {
    const val = text.trim();
    if (!val || disabled) return;
    onSend(val);
    setText('');
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          onSend(file.name, {
            fileUrl: reader.result,
            fileType: file.type,
            fileName: file.name,
          });
        };
        reader.readAsDataURL(file);
      } else {
        onSend(`📁 Attached file: ${file.name}`);
      }
      e.target.value = '';
    }
  };

  return (
    <div className="wa-input-bar-container" style={{ position: 'relative' }}>
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            className="emoji-picker-popup"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '12px',
              marginBottom: '12px',
              zIndex: 1000,
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            <EmojiPicker
              theme={Theme.DARK}
              onEmojiClick={(emojiData) => handleEmojiClick(emojiData.emoji)}
              width={350}
              height={400}
              searchPlaceHolder="Search all emojis..."
            />
          </motion.div>
        )}
      </AnimatePresence>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className="wa-input-bar">
        <button
          className="wa-icon-btn"
          aria-label="Emoji"
          disabled={disabled}
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          type="button"
        >
          <EmojiIcon />
        </button>

        <button
          className="wa-icon-btn"
          aria-label="Attach file"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <AttachIcon />
        </button>

        <input
          id="message-input"
          ref={inputRef}
          className="wa-text-input"
          type="text"
          placeholder={placeholder || 'Type a message...'}
          onKeyDown={handleKey}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          autoComplete="off"
        />

        <button
          id="send-btn"
          className="wa-send-btn"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          aria-label="Send message"
          type="button"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   CHAT WINDOW
═══════════════════════════════════════════════ */
const ChatWindow = ({ selectedUser, onRefreshSidebar }) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage, removeMessage, clearAllMessages, editExistingMessage } = useChat(selectedUser);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [friendStatus, setFriendStatus] = useState('none');
  const [isBlocked, setIsBlocked] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const bottomRef = useRef(null);
  const menuRef = useRef(null);

  const targetId = selectedUser?._id || selectedUser?.id;

  // Load status for selected user
  useEffect(() => {
    if (!targetId) return;

    // Check friendship status
    getFriendshipStatus(targetId)
      .then((st) => {
        setFriendStatus(st);
        setIsBlocked(st === 'blocked');
      })
      .catch(() => {});

    // Check archive status
    getChatPreferences()
      .then((prefs) => {
        const p = prefs.find((x) => x.target_user_id === targetId);
        setIsArchived(!!p?.is_archived);
      })
      .catch(() => {});
  }, [targetId]);

  // Click outside menu
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content, fileData = null) => {
    if (isBlocked) {
      toast.error('Cannot send message: User is blocked');
      return;
    }
    try {
      await sendMessage(content, fileData);
      if (onRefreshSidebar) onRefreshSidebar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send message');
    }
  };

  const handleBlockToggle = async () => {
    setShowHeaderMenu(false);
    try {
      if (isBlocked) {
        await unblockUser(targetId);
        setIsBlocked(false);
        setFriendStatus('none');
        toast.success(`Unblocked ${selectedUser.username}`);
      } else {
        await blockUser(targetId);
        setIsBlocked(true);
        setFriendStatus('blocked');
        toast.success(`Blocked ${selectedUser.username}`);
      }
      if (onRefreshSidebar) onRefreshSidebar();
    } catch {
      toast.error('Failed to update block status');
    }
  };

  const handleArchiveToggle = async () => {
    setShowHeaderMenu(false);
    try {
      if (isArchived) {
        await unarchiveChat(targetId);
        setIsArchived(false);
        toast.success('Chat unarchived');
      } else {
        await archiveChat(targetId);
        setIsArchived(true);
        toast.success('Chat archived');
      }
      if (onRefreshSidebar) onRefreshSidebar();
    } catch {
      toast.error('Failed to update archive status');
    }
  };

  const handleAddFriend = async () => {
    setShowHeaderMenu(false);
    try {
      await sendFriendRequest({ friendId: targetId });
      setFriendStatus('pending_sent');
      toast.success(`Friend request sent to ${selectedUser.username}!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send friend request');
    }
  };

  const handleClearChat = () => {
    setShowHeaderMenu(false);
    if (window.confirm('Are you sure you want to clear this chat history?')) {
      clearAllMessages();
      toast.success('Chat cleared');
    }
  };

  const grouped = groupByDate(messages);

  return (
    <div className="chat-main">
      <div className="chat-bg-pattern" />

      {/* NO USER SELECTED */}
      {!selectedUser && (
        <div className="chat-empty" style={{ flex: 1 }}>
          <motion.div
            className="empty-icon"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            💬
          </motion.div>
          <div className="empty-title">Welcome to Zylo Chat</div>
          <div className="empty-desc">
            Select a conversation from the sidebar or click "+ New" to add friends.
          </div>
        </div>
      )}

      {/* USER SELECTED */}
      {selectedUser && (
        <>
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-user">
              <div className="user-avatar sm">
                {getInitials(selectedUser.username || '')}
                <div className={`avatar-online ${isBlocked ? 'blocked' : ''}`} />
              </div>
              <div>
                <div className="chat-header-name-row">
                  <span className="chat-header-name">{selectedUser.username}</span>
                  {friendStatus === 'friends' && (
                    <span className="friend-tag">Friend</span>
                  )}
                  {isArchived && (
                    <span className="archive-tag">Archived</span>
                  )}
                </div>
                <div className="chat-header-status">
                  {isBlocked ? '🚫 Blocked' : '● Online'}
                </div>
              </div>
            </div>

            <div className="chat-header-actions" style={{ position: 'relative' }} ref={menuRef}>
              {friendStatus === 'none' && (
                <button
                  className="quick-add-btn"
                  onClick={handleAddFriend}
                  title="Add as friend"
                >
                  + Add Friend
                </button>
              )}

              <button
                className="icon-btn"
                title="Options menu"
                aria-label="Options menu"
                onClick={() => setShowHeaderMenu((prev) => !prev)}
                id="chat-options-menu-btn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5" r="1" fill="currentColor"/>
                  <circle cx="12" cy="12" r="1" fill="currentColor"/>
                  <circle cx="12" cy="19" r="1" fill="currentColor"/>
                </svg>
              </button>

              {/* Options Dropdown Menu */}
              <AnimatePresence>
                {showHeaderMenu && (
                  <motion.div
                    className="chat-header-dropdown"
                    initial={{ opacity: 0, scale: 0.95, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  >
                    {friendStatus === 'none' && (
                      <button className="chat-menu-item" onClick={handleAddFriend}>
                        <span>👤</span> Add Friend
                      </button>
                    )}

                    <button className="chat-menu-item" onClick={handleArchiveToggle}>
                      <span>📦</span> {isArchived ? 'Unarchive Chat' : 'Archive Chat'}
                    </button>

                    <button className="chat-menu-item" onClick={handleClearChat}>
                      <span>🧹</span> Clear Chat
                    </button>

                    <div className="dropdown-divider" style={{ margin: '4px 0' }} />

                    <button
                      className="chat-menu-item danger"
                      onClick={handleBlockToggle}
                    >
                      <span>🚫</span> {isBlocked ? 'Unblock User' : 'Block User'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-messages" id="chat-messages">
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                <div className="spinner" />
              </div>
            )}

            {!loading && messages.length === 0 && (
              <div className="chat-empty" style={{ flex: 'unset', paddingTop: 40 }}>
                <div className="empty-icon" style={{ width: 60, height: 60, fontSize: 26 }}>👋</div>
                <div className="empty-title" style={{ fontSize: '1rem' }}>
                  Say hello to {selectedUser.username}!
                </div>
                <div className="empty-desc" style={{ fontSize: '0.82rem' }}>
                  Be the first to send a message.
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {Object.entries(grouped).map(([date, msgs]) => (
                <div key={date}>
                  <div className="date-separator">{date}</div>
                  {msgs.map((msg) => (
                    <MessageBubble
                      key={msg._id}
                      message={msg}
                      isSent={msg.sender === user._id || msg.sender?._id === user._id}
                      onDelete={(id) => removeMessage(id)}
                      onEdit={(id, newText) => editExistingMessage(id, newText)}
                    />
                  ))}
                </div>
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>

          {/* Blocked Notification Banner */}
          {isBlocked ? (
            <div className="blocked-chat-banner">
              <div className="blocked-banner-content">
                <span className="blocked-icon">🚫</span>
                <span>You have blocked <strong>{selectedUser.username}</strong>. You cannot send or receive messages.</span>
              </div>
              <button className="btn-unblock-banner" onClick={handleBlockToggle}>
                Unblock
              </button>
            </div>
          ) : (
            <InlineInput
              onSend={handleSend}
              disabled={loading}
              placeholder={`Message ${selectedUser.username}...`}
            />
          )}
        </>
      )}

      {/* INPUT WHEN NO USER SELECTED */}
      {!selectedUser && (
        <InlineInput
          onSend={() => {}}
          disabled={true}
          placeholder="← Select a contact from the sidebar to start chatting"
        />
      )}
    </div>
  );
};

export default ChatWindow;
