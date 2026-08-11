import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuth from '../hooks/useAuth';

const TopNav = ({
  activeTab,
  setActiveTab,
  pendingCount = 0,
  onOpenAddFriend,
  theme,
  setTheme
}) => {
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getInitials = (name = '') =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="top-nav">
      {/* Left Navigation Buttons (Vibly Chat style) */}
      <div className="top-nav-left">
        {/* Chats Tab */}
        <button
          className={`top-nav-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
          title="Chats"
          id="nav-chats-tab"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>

        {/* Friends / Contacts Tab */}
        <button
          className={`top-nav-btn ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
          title="Friends & Contacts"
          id="nav-friends-tab"
          style={{ position: 'relative' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          {pendingCount > 0 && (
            <span className="nav-badge">{pendingCount}</span>
          )}
        </button>

        {/* Archived Tab */}
        <button
          className={`top-nav-btn ${activeTab === 'archived' ? 'active' : ''}`}
          onClick={() => setActiveTab('archived')}
          title="Archived Chats"
          id="nav-archived-tab"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="5" rx="2"/>
            <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/>
            <path d="M10 13h4"/>
          </svg>
        </button>

        {/* Blocked Tab */}
        <button
          className={`top-nav-btn ${activeTab === 'blocked' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocked')}
          title="Blocked Users"
          id="nav-blocked-tab"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
        </button>
      </div>

      {/* Center Brand Title */}
      <div className="top-nav-center">
        <span className="top-nav-logo-icon">⚡</span>
        <span className="top-nav-title">Zylo Chat</span>
      </div>

      {/* Right Action Icons & Profile */}
      <div className="top-nav-right">
        {/* Quick Add Friend Button */}
        <button
          className="top-nav-icon-btn"
          title="Add Friend / New Chat"
          onClick={onOpenAddFriend}
          id="top-add-friend-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
        </button>

        {/* User Profile Avatar with dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="top-nav-avatar-btn"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            title={user?.username || 'Profile'}
            id="top-profile-menu-btn"
          >
            <div className="top-avatar">
              {getInitials(user?.username || 'User')}
              <span className="top-avatar-status" />
            </div>
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="top-profile-dropdown"
              >
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-avatar">
                    {getInitials(user?.username || '')}
                  </div>
                  <div className="profile-dropdown-info">
                    <div className="profile-name">{user?.username}</div>
                    <div className="profile-email">{user?.email || 'Active now'}</div>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenAddFriend();
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  Add Friend / Contacts
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowProfileMenu(false);
                    setActiveTab('blocked');
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                  Blocked Users
                </button>
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item danger"
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Log Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
