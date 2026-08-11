import { motion } from 'framer-motion';

const getInitials = (name = '') =>
  (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

const UserCard = ({ user, lastMessage, time, unread, isActive, onClick }) => {
  return (
    <motion.div
      className={`user-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={{ x: 2 }}
    >
      <div className="user-avatar">
        {getInitials(user.username || user.name || 'U')}
        <div className="avatar-online" />
      </div>
      <div className="user-card-info">
        <div className="user-card-name">{user.username || user.name}</div>
        {lastMessage && (
          <div className="user-card-meta">{lastMessage}</div>
        )}
        {!lastMessage && user.email && (
          <div className="user-card-meta">{user.email}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {time && <div className="user-card-time">{time}</div>}
        {unread > 0 && <div className="unread-badge">{unread}</div>}
      </div>
    </motion.div>
  );
};

export default UserCard;
