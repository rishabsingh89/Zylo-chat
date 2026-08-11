import { useState, useEffect, useCallback, useRef } from 'react';

/* ── Icons ── */
const CutIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="20" r="3"/><circle cx="18" cy="20" r="3"/>
    <path d="M8.12 8.12 12 12m0 0 7.88-7.88M12 12 8.12 15.88M12 12l7.88 7.88M2 2l4.1 4.1"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const PasteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);

/* Get selected text + bounding rect for BOTH plain text and input/textarea */
const getSelectionInfo = () => {
  const active = document.activeElement;
  const isField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

  if (isField) {
    const start = active.selectionStart;
    const end   = active.selectionEnd;
    if (start === end) return null;                   // no selection
    const text  = active.value.slice(start, end);
    if (!text.trim()) return null;
    // Get bounding rect of the input element itself (toolbar appears above it)
    const rect  = active.getBoundingClientRect();
    return { text, rect, isField: true, el: active, start, end };
  }

  // Regular DOM selection
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return null;
  const range = sel.getRangeAt(0);
  const rect  = range.getBoundingClientRect();
  if (rect.width === 0) return null;
  return { text: sel.toString(), rect, isField: false };
};

const SelectionToolbar = () => {
  const [visible, setVisible]   = useState(false);
  const [pos, setPos]           = useState({ top: 0, left: 0 });
  const [copied, setCopied]     = useState(false);
  const [selInfo, setSelInfo]   = useState(null);
  const toolbarRef              = useRef(null);
  const hideTimer               = useRef(null);

  const hide = useCallback(() => {
    setVisible(false);
    setCopied(false);
    setSelInfo(null);
  }, []);

  const tryShow = useCallback(() => {
    const info = getSelectionInfo();
    if (!info) { hide(); return; }
    const { rect } = info;
    setSelInfo(info);
    setPos({
      top:  rect.top  + window.scrollY - 48,
      left: rect.left + window.scrollX + rect.width / 2,
    });
    setVisible(true);
  }, [hide]);

  useEffect(() => {
    const onMouseUp = (e) => {
      if (toolbarRef.current?.contains(e.target)) return;
      clearTimeout(hideTimer.current);
      setTimeout(tryShow, 30);
    };

    const onMouseDown = (e) => {
      if (toolbarRef.current?.contains(e.target)) return;
      hideTimer.current = setTimeout(hide, 120);
    };

    // Also listen for keyboard selection inside inputs
    const onKeyUp = (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Shift','Home','End','a','A'].includes(e.key) || e.shiftKey) {
        setTimeout(tryShow, 30);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') hide();
    };

    document.addEventListener('mouseup',   onMouseUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keyup',     onKeyUp);
    document.addEventListener('keydown',   onKeyDown);
    return () => {
      document.removeEventListener('mouseup',   onMouseUp);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keyup',     onKeyUp);
      document.removeEventListener('keydown',   onKeyDown);
      clearTimeout(hideTimer.current);
    };
  }, [hide, tryShow]);

  /* ── Actions ── */
  const handleCopy = async () => {
    if (!selInfo) return;
    try {
      await navigator.clipboard.writeText(selInfo.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      document.execCommand('copy');
    }
  };

  const handleCut = async () => {
    if (!selInfo) return;
    try { await navigator.clipboard.writeText(selInfo.text); } catch { document.execCommand('copy'); }
    if (selInfo.isField) {
      const el = selInfo.el;
      const { start, end } = selInfo;
      const nativeInput = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
                          Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      // Use React-compatible value setter
      nativeInput?.set?.call(el, el.value.slice(0, start) + el.value.slice(end));
      el.selectionStart = el.selectionEnd = start;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('delete');
    }
    hide();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const start = active.selectionStart ?? active.value.length;
        const end   = active.selectionEnd   ?? active.value.length;
        const nativeInput = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
                            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        nativeInput?.set?.call(active, active.value.slice(0, start) + text + active.value.slice(end));
        active.selectionStart = active.selectionEnd = start + text.length;
        active.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        document.execCommand('insertText', false, text);
      }
    } catch {
      document.execCommand('paste');
    }
    hide();
  };

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="sel-toolbar"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="sel-toolbar-arrow" />

      <button className="sel-btn" onClick={handleCut}   title="Cut">
        <CutIcon /><span>Cut</span>
      </button>
      <div className="sel-divider" />
      <button className="sel-btn" onClick={handleCopy}  title="Copy">
        <CopyIcon /><span>{copied ? 'Copied!' : 'Copy'}</span>
      </button>
      <div className="sel-divider" />
      <button className="sel-btn" onClick={handlePaste} title="Paste">
        <PasteIcon /><span>Paste</span>
      </button>
    </div>
  );
};

export default SelectionToolbar;
