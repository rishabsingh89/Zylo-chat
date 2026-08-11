import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UserCard from './UserCard';
import { searchUsers } from '../services/userService';
import { getConversations } from '../services/chatService';
import {
  getFriendsList,
  getBlockedUsers,
  getChatPreferences,
  unblockUser,
  unarchiveChat
} from '../services/friendService';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const FilterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="4" y1="6" x2="20" y2="6"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
    <line x1="10" y1="18" x2="14" y2="18"/>
  </svg>
);

const Sidebar = ({
  selectedUser,
  onSelectUser,
  onOpenAddFriend,
  currentFilter = 'all',
  onFilterChange
}) => {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = useCallback(() => {
    setLoadingConvos(true);
    Promise.all([
      getConversations().catch(() => []),
      getFriendsList().catch(() => []),
      getBlockedUsers().catch(() => []),
      getChatPreferences().catch(() => []),
    ])
      .then(([convos, frs, blks, prefs]) => {
        setConversations(convos || []);
        setFriends(frs || []);
        setBlockedUsers(blks || []);
        setPreferences(prefs || []);
      })
      .finally(() => setLoadingConvos(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, currentFilter]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const myId = user._id || user.id;
        setSearchResults(results.filter((u) => (u._id || u.id) !== myId));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, user]);

  const handleSelect = useCallback((u) => {
    onSelectUser(u);
    setQuery('');
    setSearchResults([]);
  }, [onSelectUser]);

  const handleUnblock = async (uId, e) => {
    e.stopPropagation();
    try {
      await unblockUser(uId);
      toast.success('User unblocked');
      loadData();
    } catch {
      toast.error('Failed to unblock user');
    }
  };

  const handleUnarchive = async (uId, e) => {
    e.stopPropagation();
    try {
      await unarchiveChat(uId);
      toast.success('Chat moved to active messages');
      loadData();
    } catch {
      toast.error('Failed to unarchive chat');
    }
  };

  const getInitials = (name = '') =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  // Check archived mapping
  const archivedMap = new Set(
    preferences.filter((p) => p.is_archived).map((p) => p.target_user_id)
  );

  // Filter conversations based on selected filter
  const getFilteredConversations = () => {
    if (currentFilter === 'archived') {
      return conversations.filter((c) => archivedMap.has(c.user?._id || c.user?.id));
    }
    if (currentFilter === 'unread') {
      return conversations.filter((c) => (c.unread_count > 0 || c.lastMessage?.status === 'sent') && !archivedMap.has(c.user?._id || c.user?.id));
    }
    // Default 'all'
    return conversations.filter((c) => !archivedMap.has(c.user?._id || c.user?.id));
  };

  const filteredConvos = getFilteredConversations();

  const filterLabels = {
    all: 'All Chats',
    unread: 'Unread Chats',
    archived: 'Archived Chats',
    friends: 'Friends Only',
    blocked: 'Blocked Users',
  };

  return (
    <div className="sidebar">
      {/* Header bar matching Vibly Chat */}
      <div className="sidebar-top-section">
        <div className="sidebar-title-row">
          <h2 className="sidebar-main-title">Chats</h2>
          
          <div className="sidebar-actions-group">
            {/* + New Button */}
            <button
              className="action-btn-new"
              onClick={onOpenAddFriend}
              title="Add Friend / New Chat"
              id="sidebar-new-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              <span>+ New</span>
            </button>

            {/* Filter Button & Dropdown */}
            <div style={{ position: 'relative' }} ref={filterDropdownRef}>
              <button
                className={`action-btn-filter ${currentFilter !== 'all' ? 'active' : ''}`}
                onClick={() => setShowFilterDropdown((prev) => !prev)}
                title="Filter conversations"
                id="sidebar-filter-btn"
              >
                <FilterIcon />
                <span>Filter</span>
              </button>

              <AnimatePresence>
                {showFilterDropdown && (
                  <motion.div
                    className="vibly-filter-dropdown"
                    initial={{ opacity: 0, scale: 0.95, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  >
                    <button
                      className={`filter-item ${currentFilter === 'all' ? 'selected' : ''}`}
                      onClick={() => {
                        onFilterChange('all');
                        setShowFilterDropdown(false);
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                      </svg>
                      All Chats
                    </button>

                    <button
                      className={`filter-item ${currentFilter === 'unread' ? 'selected' : ''}`}
                      onClick={() => {
                        onFilterChange('unread');
                        setShowFilterDropdown(false);
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="8"/>
                        <circle cx="12" cy="12" r="3" fill="currentColor"/>
                      </svg>
                      Unread Chats
                    </button>

                    <button
                      className={`filter-item ${currentFilter === 'archived' ? 'selected' : ''}`}
                      onClick={() => {
                        onFilterChange('archived');
                        setShowFilterDropdown(false);
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="5" rx="2"/>
                        <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/>
                        <path d="M10 13h4"/>
                      </svg>
                      Archived Chats
                    </button>

                    <button
                      className={`filter-item ${currentFilter === 'friends' ? 'selected' : ''}`}
                      onClick={() => {
                        onFilterChange('friends');
                        setShowFilterDropdown(false);
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                      </svg>
                      Friends Only
                    </button>

                    <button
                      className={`filter-item ${currentFilter === 'blocked' ? 'selected' : ''}`}
                      onClick={() => {
                        onFilterChange('blocked');
                        setShowFilterDropdown(false);
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                      </svg>
                      Blocked Users
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Search Contact / Chat Bar */}
        <div className="search-bar">
          <span className="search-icon"><SearchIcon /></span>
          <input
            id="sidebar-search"
            type="text"
            placeholder="Search contact / chat"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {searching && <div className="spinner sm" />}
          {query && (
            <button className="search-clear-btn" onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        {/* Active Filter Pill */}
        {currentFilter !== 'all' && (
          <div className="active-filter-banner">
            <span>Filtering by: <strong>{filterLabels[currentFilter]}</strong></span>
            <button onClick={() => onFilterChange('all')}>Clear filter ✕</button>
          </div>
        )}
      </div>

      {/* Body List */}
      <div className="sidebar-body">
        <AnimatePresence mode="wait">
          {/* SEARCH RESULTS VIEW */}
          {query.trim() ? (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="search-results"
            >
              <div className="sidebar-section-label">Search Results</div>
              {searchResults.length === 0 && !searching && (
                <div className="no-results">No contacts found</div>
              )}
              {searchResults.map((u) => (
                <UserCard
                  key={u._id || u.id}
                  user={u}
                  isActive={selectedUser?._id === (u._id || u.id)}
                  onClick={() => handleSelect(u)}
                />
              ))}
            </motion.div>
          ) : currentFilter === 'friends' ? (
            /* FRIENDS ONLY VIEW */
            <motion.div
              key="friends-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="sidebar-section-label">My Friends ({friends.length})</div>
              {friends.length === 0 && (
                <div className="no-results">
                  No friends added yet.<br />
                  <button className="link-btn" onClick={onOpenAddFriend} style={{ marginTop: 8 }}>
                    + Add a friend
                  </button>
                </div>
              )}
              {friends.map((f) => (
                <UserCard
                  key={f._id || f.id}
                  user={f}
                  isActive={selectedUser?._id === (f._id || f.id)}
                  onClick={() => handleSelect(f)}
                />
              ))}
            </motion.div>
          ) : currentFilter === 'blocked' ? (
            /* BLOCKED USERS VIEW */
            <motion.div
              key="blocked-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="sidebar-section-label">Blocked Users ({blockedUsers.length})</div>
              {blockedUsers.length === 0 && (
                <div className="no-results">No blocked users</div>
              )}
              {blockedUsers.map((b) => {
                const bId = b._id || b.id;
                return (
                  <div key={bId} className="blocked-sidebar-card">
                    <div className="user-avatar sm">
                      {getInitials(b.username || '')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="blocked-card-name">{b.username}</div>
                      <div className="blocked-card-sub">Blocked</div>
                    </div>
                    <button
                      className="unblock-btn"
                      onClick={(e) => handleUnblock(bId, e)}
                    >
                      Unblock
                    </button>
                  </div>
                );
              })}
            </motion.div>
          ) : currentFilter === 'archived' ? (
            /* ARCHIVED CHATS VIEW */
            <motion.div
              key="archived-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="sidebar-section-label">Archived Chats ({filteredConvos.length})</div>
              {filteredConvos.length === 0 && (
                <div className="no-results">No archived conversations</div>
              )}
              {filteredConvos.map((conv) => {
                const uId = conv.user?._id || conv.user?.id;
                return (
                  <div key={uId} style={{ position: 'relative' }}>
                    <UserCard
                      user={conv.user}
                      lastMessage={conv.lastMessage?.content}
                      time={conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : null}
                      isActive={selectedUser?._id === uId}
                      onClick={() => handleSelect(conv.user)}
                    />
                    <button
                      className="unarchive-overlay-btn"
                      title="Unarchive chat"
                      onClick={(e) => handleUnarchive(uId, e)}
                    >
                      Unarchive
                    </button>
                  </div>
                );
              })}
            </motion.div>
          ) : (
            /* ALL CHATS & CONVERSATIONS */
            <motion.div
              key="convos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="sidebar-section-label">
                {currentFilter === 'unread' ? 'Unread Messages' : 'Messages'}
              </div>
              {loadingConvos && (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
              )}
              {!loadingConvos && filteredConvos.length === 0 && (
                <div className="no-results">
                  {currentFilter === 'unread'
                    ? 'No unread messages'
                    : 'No conversations yet.\nClick "+ New" to add friends and start chatting!'}
                </div>
              )}
              {filteredConvos.map((conv) => (
                <UserCard
                  key={conv.user?._id || conv.user?.id}
                  user={conv.user}
                  lastMessage={conv.lastMessage?.content}
                  time={conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : null}
                  isActive={selectedUser?._id === (conv.user?._id || conv.user?.id)}
                  onClick={() => handleSelect(conv.user)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer User Info */}
      <div className="sidebar-footer">
        <div className="user-avatar sm" style={{ width: 34, height: 34, fontSize: '0.75rem', flexShrink: 0 }}>
          {getInitials(user?.username || '')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.username}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Online</div>
        </div>
        <button className="logout-btn" onClick={logout} id="logout-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
};

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default Sidebar;
