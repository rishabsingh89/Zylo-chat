import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MessageBubble = ({ message, isSent, onDelete, onEdit }) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || '');

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isImage =
    message.fileType?.startsWith('image/') ||
    message.fileUrl?.startsWith('data:image/') ||
    message.fileUrl?.startsWith('http') ||
    /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i.test(message.fileName || '') ||
    /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i.test(message.content || '') ||
    message.content?.startsWith('data:image/');

  const isVideo =
    message.fileType?.startsWith('video/') ||
    /\.(mp4|webm|ogg)($|\?)/i.test(message.fileName || '') ||
    /\.(mp4|webm|ogg)($|\?)/i.test(message.content || '');

  const imgSrc = message.fileUrl || (message.content?.startsWith('data:image/') || message.content?.startsWith('http') ? message.content : null);
  const mediaSrc = message.fileUrl || message.content;

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit?.(message._id, editText.trim());
      setIsEditing(false);
    }
  };

  return (
    <>
      <motion.div
        className={`message-row ${isSent ? 'sent' : ''}`}
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
        style={{ position: 'relative' }}
      >
        <div className={`message-bubble ${isSent ? 'sent' : 'received'}`} style={{ position: 'relative' }}>
          {/* Action Menu (Delete & Edit) */}
          {showOptions && (
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                right: isSent ? 'auto' : '8px',
                left: isSent ? '8px' : 'auto',
                display: 'flex',
                gap: '4px',
                background: 'rgba(17, 24, 39, 0.9)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '2px 6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 20,
              }}
            >
              {/* Edit button (for sent text messages) */}
              {isSent && !isImage && !isVideo && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Edit message"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  ✏️
                </button>
              )}
              {/* Delete button */}
              <button
                type="button"
                onClick={() => onDelete?.(message._id)}
                title="Delete message"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                🗑️
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
            (!isImage && !isVideo) || (message.content && message.content !== message.fileName && message.content !== imgSrc) ? (
              <div>{message.content}</div>
            ) : null
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
