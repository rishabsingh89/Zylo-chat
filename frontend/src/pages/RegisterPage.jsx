import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/authService';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';

/* ── Eye Icons ── */
const EyeOpen = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeClosed = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const RegisterPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.username.trim()) e.username = 'Username is required';
    else if (form.username.length < 3) e.username = 'At least 3 characters';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'At least 6 characters';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    return e;
  };

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setErrors((p) => ({ ...p, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    setErrors({});
    try {
      const data = await registerUser({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      login(data.user, data.token);
      toast.success(`Account created! Welcome, ${data.user.name || data.user.username} 🎉`);
      navigate('/chat');
    } catch (err) {
      let msg = '';
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        msg = detail.map((d) => (typeof d === 'string' ? d : d.msg || d.message || JSON.stringify(d))).join('; ');
      } else if (typeof err.response?.data === 'string' && err.response.data.trim()) {
        msg = err.response.data.length < 150 ? err.response.data : `Server error (${err.response.status})`;
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.message) {
        msg = err.message.includes('Network Error') ? 'Unable to connect to server (http://127.0.0.1:8000). Please ensure backend is running.' : err.message;
      } else {
        msg = 'Registration failed. Please try again.';
      }

      toast.error(msg);
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('email')) {
        setErrors((p) => ({ ...p, email: msg }));
      } else if (lowerMsg.includes('username')) {
        setErrors((p) => ({ ...p, username: msg }));
      } else {
        setErrors((p) => ({ ...p, general: msg }));
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="nm-layout">
      {/* ── LEFT PANEL ── */}
      <motion.div
        className="nm-left"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55 }}
      >
        <div className="nm-logo">
          <div className="nm-logo-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span className="nm-logo-text">ZyloApp</span>
        </div>

        <div className="nm-tagline">
          Join the<br />conversation.
        </div>
        <p className="nm-desc">Create your free account and start chatting instantly.</p>

        <div className="nm-features">
          {[
            { icon: '⚡', label: 'Instant messaging' },
            { icon: '🔍', label: 'Find anyone' },
            { icon: '📜', label: 'Full history' },
          ].map(({ icon, label }) => (
            <div className="nm-feature-item" key={label}>
              <div className="nm-feature-icon" style={{ fontSize: 16 }}>{icon}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── RIGHT PANEL ── */}
      <div className="nm-right">
        <motion.div
          className="nm-card nm-card-glow"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="nm-card-title">Create account ✨</h1>
          <p className="nm-card-sub">Join Zylo Chat — it's free</p>

          <form onSubmit={handleSubmit} noValidate id="register-form">

            {/* Full Name */}
            <div className="nm-field">
              <label className="nm-label" htmlFor="reg-name">Full Name</label>
              <input
                id="reg-name"
                className="nm-input"
                type="text"
                name="name"
                placeholder="Thomas Ramesh"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                autoFocus
              />
              <AnimatePresence>
                {errors.name && (
                  <motion.div className="nm-error"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {errors.name}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Username */}
            <div className="nm-field">
              <label className="nm-label" htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                className="nm-input"
                type="text"
                name="username"
                placeholder="thomas123"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
              />
              <AnimatePresence>
                {errors.username && (
                  <motion.div className="nm-error"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {errors.username}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>


            {/* Email */}
            <div className="nm-field">
              <label className="nm-label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                className="nm-input"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
              <AnimatePresence>
                {errors.email && (
                  <motion.div className="nm-error"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {errors.email}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Password */}
            <div className="nm-field">
              <label className="nm-label" htmlFor="reg-password">Password</label>
              <div className="nm-input-wrap">
                <input
                  id="reg-password"
                  className="nm-input"
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="nm-eye-btn"
                  onClick={() => setShowPass((p) => !p)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOpen /> : <EyeClosed />}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.div className="nm-error"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {errors.password}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Confirm Password */}
            <div className="nm-field">
              <label className="nm-label" htmlFor="reg-confirm">Confirm Password</label>
              <div className="nm-input-wrap">
                <input
                  id="reg-confirm"
                  className="nm-input"
                  type={showConfirm ? 'text' : 'password'}
                  name="confirm"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={handleChange}
                  autoComplete="new-password"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="nm-eye-btn"
                  onClick={() => setShowConfirm((p) => !p)}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOpen /> : <EyeClosed />}
                </button>
              </div>
              <AnimatePresence>
                {errors.confirm && (
                  <motion.div className="nm-error"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {errors.confirm}
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {errors.general && (
                  <motion.div className="nm-error" style={{ marginBottom: 12, textAlign: 'center' }}
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {errors.general}
                  </motion.div>
                )}
              </AnimatePresence>

            <button id="register-submit" className="nm-btn" type="submit" disabled={loading}>
              {loading ? <><div className="spinner" /> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <p className="nm-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RegisterPage;
