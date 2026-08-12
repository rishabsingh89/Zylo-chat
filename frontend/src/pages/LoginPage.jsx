import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../services/authService';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';

/* ── Icons ── */
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

/* ── Feature list ── */
const features = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    ),
    label: 'Real-time',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    ),
    label: 'Secure',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    ),
    label: 'Anywhere',
  },
];

/* ── Animated Particle dot ── */
const Particle = ({ style }) => <div className="nm-particle" style={style} />;

/* ── Pre-generate stable particles (useMemo so they don't re-randomize) ── */
const useParticles = (count = 28) =>
  useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 3 + 1.5,
      delay: Math.random() * 6,
      duration: Math.random() * 6 + 5,
      opacity: Math.random() * 0.45 + 0.12,
    })),
  []);

/* ═══════════════════════════════════════════════
   LOGIN PAGE
═══════════════════════════════════════════════ */
const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const particles = useParticles(28);

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
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
      const data = await loginUser({ email: form.email.trim(), password: form.password });
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.username}! 👋`);
      navigate('/chat');
    } catch (err) {
      let msg = 'Invalid email or password';
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        msg = detail.map((d) => (typeof d === 'string' ? d : d.msg || d.message || JSON.stringify(d))).join('; ');
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.message && !err.response) {
        msg = 'Unable to connect to server. Please check your network connection.';
      }
      toast.error(msg);
      setErrors({ email: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nm-layout">

      {/* ── ANIMATED PARTICLE BACKGROUND ── */}
      <div className="nm-particles-bg" aria-hidden="true">
        {particles.map((p) => (
          <Particle
            key={p.id}
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* ── LEFT PANEL ── */}
      <motion.div
        className="nm-left"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55 }}
      >
        {/* Logo */}
        <div className="nm-logo">
          <div className="nm-logo-icon">
            {/* Lightning bolt */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <span className="nm-logo-text">ZyloApp</span>
        </div>

        {/* Tagline */}
        <div className="nm-tagline">
          Connect without<br />
          <span className="nm-tagline-accent">boundaries.</span>
        </div>
        <p className="nm-desc">Real-time chat for the modern world.</p>

        {/* Features */}
        <div className="nm-features">
          {features.map(({ icon, label }) => (
            <div className="nm-feature-item" key={label}>
              <div className="nm-feature-icon">{icon}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── RIGHT PANEL (Glowing Card) ── */}
      <div className="nm-right">
        <motion.div
          className="nm-card nm-card-glow"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="nm-card-title">Welcome back 👋</h1>
          <p className="nm-card-sub">Sign in to continue to Zylo Chat</p>

          <form onSubmit={handleSubmit} noValidate id="login-form">
            {/* Email */}
            <div className="nm-field">
              <label className="nm-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
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
              <label className="nm-label" htmlFor="login-password">Password</label>
              <div className="nm-input-wrap">
                <input
                  id="login-password"
                  className="nm-input"
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  style={{ paddingRight: 44 }}
                />
                <button type="button" className="nm-eye-btn"
                  onClick={() => setShowPass((p) => !p)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}>
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

            <button id="login-submit" className="nm-btn" type="submit" disabled={loading}>
              {loading ? <><div className="spinner" /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          <p className="nm-switch">
            Don't have an account? <Link to="/register">Create one free</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
