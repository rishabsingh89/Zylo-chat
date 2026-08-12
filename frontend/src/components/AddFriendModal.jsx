import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { searchUsers } from '../services/userService';
import {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendsList,
  removeFriend
} from '../services/friendService';

const getInitials = (name = '') =>
  (name || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

const AddFriendModal = ({ isOpen, onClose, onSelectUser }) => {
  const [activeTab, setActiveTab] = useState('add'); // 'add', 'requests', 'friends'
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqData, friendData] = await Promise.all([
        getFriendRequests().catch(() => ({ incoming: [], outgoing: [] })),
        getFriendsList().catch(() => []),
      ]);
      setRequests(reqData);
      setFriends(friendData);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  // Search users debounce
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsers(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);







  const handleSendRequest = async (targetUser) => {
    const id = targetUser._id || targetUser.id;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await sendFriendRequest({ friendId: id, username: targetUser.username, email: targetUser.email });
      toast.success(`Friend request sent to ${targetUser.username}!`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleAccept = async (requestId) => {
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      await acceptFriendRequest(requestId);
      toast.success('Friend request accepted!');
      loadData();
    } catch {
      toast.error('Failed to accept request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleReject = async (requestId) => {
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      await rejectFriendRequest(requestId);
      toast.success('Friend request removed');
      loadData();
    } catch {
      toast.error('Failed to remove request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try {
      await removeFriend(friendId);
      toast.success('Friend removed');
      loadData();
    } catch {
      toast.error('Failed to remove friend');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="add-friend-modal"
        initial={{ opacity: 0, scale: 0.93, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 15 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">👥</span>
            <div>
              <h3 className="modal-title">Friends & Contacts</h3>
              <p className="modal-subtitle">Add people, respond to requests, and manage your circle</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Tab Headers */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            ➕ Add Friend
          </button>
          <button
            className={`modal-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            📬 Requests
            {requests.incoming?.length > 0 && (
              <span className="tab-pill">{requests.incoming.length}</span>
            )}
          </button>
          <button
            className={`modal-tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            ✨ My Friends ({friends.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* TAB 1: ADD FRIEND */}
          {activeTab === 'add' && (
            <div className="tab-content">
              <div className="modal-search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Enter username or email address..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                {searching && <div className="spinner sm" />}
              </div>

              <div className="modal-list">
                {searchResults.length === 0 && !searching && query.trim() && (
                  <div className="empty-state-card" style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <p style={{ marginBottom: '6px', fontSize: '0.95rem', fontWeight: 600 }}>No registered account found for "{query}"</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Please ask your friend to sign up on Zylo Chat with this username or email.</p>
                  </div>
                )}
                {searchResults.length === 0 && !query.trim() && (
                  <div className="empty-state-card">
                    <p>Type a username or email above to find friends on Zylo Chat</p>
                  </div>
                )}

                {searchResults.map((u) => {
                  const uId = u._id || u.id;
                  const isFriend = friends.some((f) => (f._id || f.id) === uId);
                  const isPending = requests.outgoing?.some(
                    (r) => r.friend_id === uId || r.receiver_id === uId || r.receiver?.id === uId || r.receiver?._id === uId
                  );

                  return (
                    <div key={uId} className="friend-card">
                      <div className="friend-card-avatar">
                        {getInitials(u.name || u.username)}
                      </div>
                      <div className="friend-card-info">
                        <div className="friend-card-name">{u.name || u.username}</div>
                        <div className="friend-card-email">@{u.username} • {u.email}</div>
                      </div>
                      <div className="friend-card-actions">
                        {isFriend ? (
                          <button
                            className="btn-pill secondary"
                            onClick={() => {
                              onSelectUser(u);
                              onClose();
                            }}
                          >
                            💬 Chat
                          </button>
                        ) : isPending ? (
                          <span className="badge-pending">Pending</span>
                        ) : (
                          <button
                            className="btn-pill primary"
                            disabled={actionLoading[uId]}
                            onClick={() => handleSendRequest(u)}
                          >
                            {actionLoading[uId] ? 'Sending...' : '+ Add Friend'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: FRIEND REQUESTS */}
          {activeTab === 'requests' && (
            <div className="tab-content">
              <h4 className="section-subtitle">Incoming Requests ({requests.incoming?.length || 0})</h4>
              <div className="modal-list">
                {(!requests.incoming || requests.incoming.length === 0) && (
                  <div className="empty-state-card">
                    <p>No pending incoming friend requests</p>
                  </div>
                )}

                {requests.incoming?.map((req) => (
                  <div key={req.id} className="friend-card">
                    <div className="friend-card-avatar">
                      {getInitials(req.sender?.username || 'U')}
                    </div>
                    <div className="friend-card-info">
                      <div className="friend-card-name">{req.sender?.username}</div>
                      <div className="friend-card-email">{req.sender?.email}</div>
                    </div>
                    <div className="friend-card-actions">
                      <button
                        className="btn-pill success"
                        disabled={actionLoading[req.id]}
                        onClick={() => handleAccept(req.id)}
                      >
                        ✓ Accept
                      </button>
                      <button
                        className="btn-pill danger"
                        disabled={actionLoading[req.id]}
                        onClick={() => handleReject(req.id)}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {requests.outgoing?.length > 0 && (
                <>
                  <h4 className="section-subtitle" style={{ marginTop: 20 }}>
                    Sent Requests ({requests.outgoing.length})
                  </h4>
                  <div className="modal-list">
                    {requests.outgoing.map((req) => (
                      <div key={req.id} className="friend-card">
                        <div className="friend-card-avatar">
                          {getInitials(req.receiver?.username || 'U')}
                        </div>
                        <div className="friend-card-info">
                          <div className="friend-card-name">{req.receiver?.username}</div>
                          <div className="friend-card-email">{req.receiver?.email}</div>
                        </div>
                        <div className="friend-card-actions">
                          <button
                            className="btn-pill secondary danger"
                            disabled={actionLoading[req.id]}
                            onClick={() => handleReject(req.id)}
                          >
                            Cancel Request
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: MY FRIENDS */}
          {activeTab === 'friends' && (
            <div className="tab-content">
              <div className="modal-list">
                {friends.length === 0 && (
                  <div className="empty-state-card">
                    <p>You have not added any friends yet.</p>
                  </div>
                )}

                {friends.map((f) => {
                  const fId = f._id || f.id;
                  return (
                    <div key={fId} className="friend-card">
                      <div className="friend-card-avatar">
                        {getInitials(f.username)}
                      </div>
                      <div className="friend-card-info">
                        <div className="friend-card-name">{f.username}</div>
                        <div className="friend-card-email">{f.email}</div>
                      </div>
                      <div className="friend-card-actions">
                        <button
                          className="btn-pill primary"
                          onClick={() => {
                            onSelectUser(f);
                            onClose();
                          }}
                        >
                          💬 Message
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Remove Friend"
                          onClick={() => handleRemoveFriend(fId)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AddFriendModal;
