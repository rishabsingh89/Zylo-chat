import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';

const MessageBubble = ({ message, isSent, onDelete, onEdit }) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || '');

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getFullMediaUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const baseUrl = api.defaults.baseURL || 'http://localhost:8000';
    const host = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const relative = path.startsWith('/') ? path : '/' + path;
    return host + relative;
  };

  const isImage =
    message.media_type === 'image' ||
    message.fileType?.startsWith('image/') ||
    message.fileUrl?.startsWith('data:image/') ||
    message.fileUrl?.startsWith('http') ||
    /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i.test(message.fileName || '') ||
    /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i.test(message.content || '') ||
    message.content?.startsWith('data:image/');

  const isVideo =
    message.media_type === 'video' ||
    message.fileType?.startsWith('video/') ||
    /\.(mp4|webm|ogg)($|\?)/i.test(message.fileName || '') ||
    /\.(mp4|webm|ogg)($|\?)/i.test(message.content || '');

  const isAudio =
    message.media_type === 'audio' ||
    message.fileType?.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a)($|\?)/i.test(message.fileName || '') ||
    /\.(mp3|wav|ogg|m4a)($|\?)/i.test(message.content || '');

  const isDocument =
    message.media_type === 'document' ||
    (!isImage && !isVideo && !isAudio && (message.media_url || message.fileUrl));

  const imgSrc = getFullMediaUrl(message.media_url || message.fileUrl || (message.content?.startsWith('data:image/') || message.content?.startsWith('http') ? message.content : null));
  const mediaSrc = getFullMediaUrl(message.media_url || message.fileUrl || message.content);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [reaction, setReaction] = useState(null);

  const handleCopyText = (e) => {
    e.stopPropagation();
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast.success("Copied to clipboard!");
    }
    setShowContextMenu(false);
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (mediaSrc) {
      const a = document.createElement('a');
      a.href = mediaSrc;
      a.download = message.file_name || message.fileName || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setShowContextMenu(false);
  };

  const handleSelectReaction = (emoji, e) => {
    e.stopPropagation();
    setReaction(emoji);
    setShowContextMenu(false);
  };

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit?.(message._id, editText.trim());
      setIsEditing(false);
    }
  };

  return (
    <>
      {showContextMenu && (
        <div 
          onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'transparent'
          }}
        />
      )}
      <motion.div
        className={`message-row ${isSent ? 'sent' : ''}`}
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ position: 'relative' }}
      >
        <div 
          className={`message-bubble ${isSent ? 'sent' : 'received'}`} 
          style={{ position: 'relative', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); setShowContextMenu(!showContextMenu); }}
        >
          {/* Action Menu (WhatsApp Context Menu & Reactions) */}
          {showContextMenu && (
            <div className={`wa-context-menu ${isSent ? 'sent-menu' : 'received-menu'}`} onClick={(e) => e.stopPropagation()}>
              {/* Reactions Bar */}
              <div className="wa-reactions-bar">
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                  <span 
                    key={emoji} 
                    className="wa-reaction-btn"
                    onClick={(e) => handleSelectReaction(emoji, e)}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
              
              {/* Options */}
              <button className="wa-menu-option" onClick={(e) => { e.stopPropagation(); toast("Reply coming soon!"); setShowContextMenu(false); }}>
                <span>↩️</span> Reply
              </button>
              
              <button className="wa-menu-option" onClick={handleCopyText}>
                <span>📋</span> Copy
              </button>
              
              <button className="wa-menu-option" onClick={(e) => { e.stopPropagation(); toast("Message Pinned!"); setShowContextMenu(false); }}>
                <span>📌</span> Pin
              </button>
              
              <button className="wa-menu-option" onClick={(e) => { e.stopPropagation(); toast("Message Starred!"); setShowContextMenu(false); }}>
                <span>⭐</span> Star
              </button>
              
              <button className="wa-menu-option" onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); }}>
                <span>☑️</span> Select
              </button>
              
              {(isImage || isVideo || isAudio || isDocument) && mediaSrc && (
                <button className="wa-menu-option" onClick={handleDownload}>
                  <span>📥</span> Save as
                </button>
              )}

              {isImage && imgSrc && (
                <button className="wa-menu-option" onClick={(e) => { e.stopPropagation(); setShowImageModal(true); setShowContextMenu(false); }}>
                  <span>🔍</span> View Fullscreen
                </button>
              )}
              
              {isSent && !isImage && !isVideo && !isAudio && !isDocument && (
                <button className="wa-menu-option" onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowContextMenu(false); }}>
                  <span>✏️</span> Edit
                </button>
              )}
              
              <button className="wa-menu-option danger" onClick={(e) => { e.stopPropagation(); onDelete?.(message._id); setShowContextMenu(false); }}>
                <span>🗑️</span> Delete
              </button>
            </div>
          )}

          {/* Image Content with WhatsApp Click-to-Enlarge */}
          {isImage && imgSrc ? (
            <div style={{ marginBottom: message.content && message.content !== message.fileName && message.content !== imgSrc ? '6px' : '0' }}>
              <img
                src={imgSrc}
                alt={message.fileName || 'Uploaded Image'}
                onClick={() => setShowImageModal(true)}
                style={{
                  maxWidth: '260px',
                  maxHeight: '260px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  display: 'block',
                  cursor: 'pointer',
                }}
              />
            </div>
          ) : null}

           {/* Video Content */}
          {isVideo && mediaSrc ? (
            <div style={{ marginBottom: '6px' }}>
              <video
                src={mediaSrc}
                controls
                style={{
                  maxWidth: '280px',
                  maxHeight: '220px',
                  borderRadius: '8px',
                  display: 'block',
                }}
              />
            </div>
          ) : null}

          {/* Audio Content */}
          {isAudio && mediaSrc ? (
            <div style={{ marginBottom: '6px' }}>
              <audio src={mediaSrc} controls style={{ maxWidth: '280px', display: 'block' }} />
            </div>
          ) : null}

          {/* Document Content */}
          {isDocument && mediaSrc ? (
            <div style={{ 
              marginBottom: '6px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'rgba(255,255,255,0.06)', 
              padding: '8px 12px', 
              borderRadius: '6px',
              maxWidth: '280px' 
            }}>
              <span style={{ fontSize: '1.5rem' }}>📁</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {message.file_name || message.fileName || 'Attachment'}
                </div>
                <div style={{ fontSize: '0.72rem', opacity: 0.6 }}>
                  {message.file_size ? `${(message.file_size / 1024 / 1024).toFixed(2)} MB` : 'Download'}
                </div>
              </div>
              <a href={mediaSrc} download target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#53bdeb', fontSize: '1.2rem', padding: '4px' }}>
                📥
              </a>
            </div>
          ) : null}

          {/* Inline Edit Form OR Regular Text Content */}
          {isEditing ? (
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', alignItems: 'center' }}>
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--accent-purple)',
                  background: 'rgba(0,0,0,0.3)',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveEdit}
                style={{
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            (!isImage && !isVideo && !isAudio && !isDocument) || (message.content && message.content !== message.fileName && message.content !== imgSrc && message.content !== message.media_url) ? (
              <div>{message.content}</div>
            ) : null
          )}

          {reaction && (
            <div className="message-reaction-badge">
              {reaction}
            </div>
          )}

          <div className="message-time">
            {formatTime(message.createdAt)}
            {message.edited && <span style={{ marginLeft: 4, opacity: 0.7, fontSize: '0.65rem' }}>(edited)</span>}
            {isSent && (
              <span className={`wa-ticks ${message.status || 'sent'}`} style={{ marginLeft: 4 }}>
                {message.optimistic ? (
                  '○'
                ) : message.status === 'read' ? (
                  <span style={{ color: '#53bdeb', fontWeight: 'bold' }}>✓✓</span>
                ) : message.status === 'delivered' ? (
                  <span style={{ color: 'rgba(233, 237, 239, 0.65)' }}>✓✓</span>
                ) : (
                  <span style={{ color: 'rgba(233, 237, 239, 0.65)' }}>✓</span>
                )}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* WhatsApp Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {showImageModal && imgSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowImageModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <button
              type="button"
              onClick={() => setShowImageModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: 'white',
                fontSize: '24px',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={imgSrc}
              alt="Full Preview"
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                objectFit: 'contain',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MessageBubble;
