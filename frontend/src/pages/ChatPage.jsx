import { useState, useEffect, useCallback } from 'react';
import TopNav from '../components/TopNav';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import AddFriendModal from '../components/AddFriendModal';
import { getFriendRequests } from '../services/friendService';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import toast from 'react-hot-toast';

const ChatPage = () => {
  const { token } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'friends', 'archived', 'blocked'
  const [currentFilter, setCurrentFilter] = useState('all'); // 'all', 'unread', 'archived', 'friends', 'blocked'
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarKey, setSidebarKey] = useState(0);

  // Sync activeTab with currentFilter
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'chats') setCurrentFilter('all');
    else if (tab === 'friends') setCurrentFilter('friends');
    else if (tab === 'archived') setCurrentFilter('archived');
    else if (tab === 'blocked') setCurrentFilter('blocked');
  };

  const handleFilterChange = (filter) => {
    setCurrentFilter(filter);
    if (filter === 'all' || filter === 'unread') setActiveTab('chats');
    else if (filter === 'friends') setActiveTab('friends');
    else if (filter === 'archived') setActiveTab('archived');
    else if (filter === 'blocked') setActiveTab('blocked');
  };

  // Load pending friend request count
  const loadPendingCount = useCallback(async () => {
    try {
      const data = await getFriendRequests();
      setPendingCount(data.incoming?.length || 0);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 15000);
    return () => clearInterval(interval);
  }, [loadPendingCount]);

  const refreshSidebar = () => {
    setSidebarKey((k) => k + 1);
    loadPendingCount();
  };

  // Connect a global WebSocket listener to refresh the sidebar in real-time when new messages arrive
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

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message' || data.type === 'presence') {
          // Trigger sidebar refresh to fetch updated conversation list/unread count
          refreshSidebar();
        }
      } catch (err) {
        // Ignored
      }
    };

    return () => {
      ws.close();
    };
  }, [token]);

  return (
    <div className="chat-app-container">
      {/* Top Header Navigation */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        pendingCount={pendingCount}
        onOpenAddFriend={() => setIsAddFriendOpen(true)}
      />

      {/* Main Chat Layout */}
      <div className="chat-layout">
        <Sidebar
          key={sidebarKey}
          selectedUser={selectedUser}
          onSelectUser={setSelectedUser}
          onOpenAddFriend={() => setIsAddFriendOpen(true)}
          currentFilter={currentFilter}
          onFilterChange={handleFilterChange}
        />
        <ChatWindow
          selectedUser={selectedUser}
          onRefreshSidebar={refreshSidebar}
        />
      </div>

      {/* Add Friend & Contacts Modal */}
      <AddFriendModal
        isOpen={isAddFriendOpen}
        onClose={() => {
          setIsAddFriendOpen(false);
          refreshSidebar();
        }}
        onSelectUser={(u) => {
          setSelectedUser(u);
          setIsAddFriendOpen(false);
          setActiveTab('chats');
          setCurrentFilter('all');
        }}
      />
    </div>
  );
};

export default ChatPage;
