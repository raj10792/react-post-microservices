import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import './App.css';

const userApi = axios.create({
  baseURL: process.env.REACT_APP_USER_API_URL || 'http://localhost:3001',
});
const postApi = axios.create({
  baseURL: process.env.REACT_APP_POST_API_URL || 'http://localhost:3002',
});
const storedSession = () => {
  try {
    return JSON.parse(localStorage.getItem('daybook-session')) || null;
  } catch {
    return null;
  }
};
const messageFromError = (error) =>
  error.response?.data?.errors?.join(', ') ||
  error.response?.data?.error ||
  'Something went wrong. Please try again.';
const initials = (name = 'New friend') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
const timeAgo = (date) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date)) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function Avatar({ name, id, size = 'normal' }) {
  const hue = (Number(id) * 47 + 184) % 360;
  return (
    <span
      aria-label={name}
      className={`avatar avatar-${size}`}
      style={{ '--avatar-color': `hsl(${hue} 43% 85%)`, '--avatar-ink': `hsl(${hue} 42% 31%)` }}
    >
      {initials(name)}
    </span>
  );
}

function Icon({ name, size = 19 }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bookmark: <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z" />,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" /><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1z" /></>,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function App() {
  const [session, setSession] = useState(storedSession);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [composer, setComposer] = useState({ title: '', content: '' });
  const [posting, setPosting] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentBusy, setCommentBusy] = useState({});
  const [query, setQuery] = useState('');
  const [savedIds, setSavedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('daybook-saved')) || [];
    } catch {
      return [];
    }
  });
  const [showSaved, setShowSaved] = useState(false);
  const searchInput = useRef(null);

  const loadPosts = useCallback(async () => {
    setFeedError('');
    try {
      const response = await postApi.get('/posts');
      setPosts(response.data);
    } catch (error) {
      setFeedError(messageFromError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    localStorage.setItem('daybook-saved', JSON.stringify(savedIds));
  }, [savedIds]);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === searchInput.current) {
        setQuery('');
        searchInput.current?.blur();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesSaved = !showSaved || savedIds.includes(post.id);
      const matchesQuery =
        !normalizedQuery ||
        `${post.title} ${post.content} ${post.author?.name || ''}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesSaved && matchesQuery;
    });
  }, [posts, query, savedIds, showSaved]);

  const requireSession = () => {
    if (session?.token) return true;
    setAuthMode('signup');
    setAuthError('');
    setAuthOpen(true);
    return false;
  };

  const authHeaders = session?.token
    ? { headers: { Authorization: `Bearer ${session.token}` } }
    : {};

  const submitPost = async (event) => {
    event.preventDefault();
    if (!requireSession()) return;
    setPosting(true);
    try {
      const response = await postApi.post(
        '/posts',
        { post: composer },
        authHeaders,
      );
      setPosts((current) => [{ ...response.data, author: session.user, comments: [] }, ...current]);
      setComposer({ title: '', content: '' });
    } catch (error) {
      setFeedError(messageFromError(error));
    } finally {
      setPosting(false);
    }
  };

  const submitComment = async (event, postId) => {
    event.preventDefault();
    if (!requireSession()) return;
    const content = (commentDrafts[postId] || '').trim();
    if (!content) return;
    setCommentBusy((current) => ({ ...current, [postId]: true }));
    try {
      const response = await postApi.post(
        `/posts/${postId}/comments`,
        { comment: { content } },
        authHeaders,
      );
      const comment = { ...response.data, author: session.user };
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, comments: [...(post.comments || []), comment] }
            : post,
        ),
      );
      setCommentDrafts((current) => ({ ...current, [postId]: '' }));
    } catch (error) {
      setFeedError(messageFromError(error));
    } finally {
      setCommentBusy((current) => ({ ...current, [postId]: false }));
    }
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      const isSignup = authMode === 'signup';
      const response = isSignup
        ? await userApi.post('/users', { user: authForm })
        : await userApi.post('/login', {
            email: authForm.email,
            password: authForm.password,
          });
      const nextSession = response.data;
      localStorage.setItem('daybook-session', JSON.stringify(nextSession));
      setSession(nextSession);
      setAuthOpen(false);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (error) {
      setAuthError(messageFromError(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const toggleSaved = (postId) => {
    setSavedIds((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId],
    );
  };

  const removePost = async (postId) => {
    if (!window.confirm('Delete this post? This can’t be undone.')) return;
    try {
      await postApi.delete(`/posts/${postId}`, authHeaders);
      setPosts((current) => current.filter((post) => post.id !== postId));
    } catch (error) {
      setFeedError(messageFromError(error));
    }
  };

  const logout = () => {
    localStorage.removeItem('daybook-session');
    setSession(null);
  };

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <a className="brand" href="#feed" aria-label="Daybook home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>daybook</span>
        </a>
        {session ? (
          <button className="icon-button" onClick={logout} aria-label="Sign out"><Icon name="logout" /></button>
        ) : (
          <button className="mobile-signin" onClick={() => { setAuthMode('login'); setAuthOpen(true); }}>Sign in</button>
        )}
      </header>

      <aside className="sidebar">
        <a className="brand" href="#feed" aria-label="Daybook home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>daybook</span>
          <span className="brand-period">.</span>
        </a>
        <p className="sidebar-label">YOUR SPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={`nav-item ${!showSaved ? 'active' : ''}`} onClick={() => setShowSaved(false)}>
            <Icon name="home" /><span>Home</span><span className="nav-dot" />
          </button>
          <button className={`nav-item ${showSaved ? 'active' : ''}`} onClick={() => setShowSaved(true)}>
            <Icon name="bookmark" /><span>Saved</span>
          </button>
        </nav>
        <div className="sidebar-note">
          <div className="note-art"><span /><span /><span /><span /></div>
          <p>A little corner<br />of the internet<br />that feels like you.</p>
          <span className="note-caption">MAKE YOURSELF AT HOME</span>
        </div>
        <div className="sidebar-bottom">
          <span className="online-indicator" />
          <span>A softer kind of social</span>
          <span className="bottom-spark">✳</span>
        </div>
      </aside>

      <main className="main-column" id="feed">
        <div className="feed-topbar">
          <div>
            <span className="eyebrow"><span className="online-indicator" /> YOUR DAILY DOSE</span>
            <h1>{showSaved ? 'Saved for later' : 'The good stuff'}</h1>
            <p className="page-subtitle">Ideas, little wins, and everything in between.</p>
          </div>
          <label className="search-box">
            <Icon name="search" />
            <input
              type="search"
              ref={searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a thought..."
              aria-label="Search posts"
            />
            <kbd>⌘ K</kbd>
          </label>
        </div>

        <div className="feed-tabs">
          <span className="tab active-tab">{showSaved ? 'Bookmarked' : 'For you'}</span>
          <span className="tab-count">{visiblePosts.length} {visiblePosts.length === 1 ? 'thought' : 'thoughts'}</span>
          <span className="feed-sort"><span className="sort-dot" /> LATEST FIRST</span>
        </div>

        {!showSaved && (
          <section className="composer-card">
            <div className="composer-top">
              {session ? (
                <Avatar name={session.user?.name} id={session.user?.id} />
              ) : (
                <div className="avatar avatar-guest"><Icon name="spark" size={18} /></div>
              )}
              <div className="composer-prompt">
                <strong>{session ? `Hey, ${session.user?.name?.split(' ')[0] || 'you'} 👋` : 'Got something on your mind?'}</strong>
                <span>The best conversations start with a little something.</span>
              </div>
            </div>
            <form className="compose-form" onSubmit={submitPost}>
              <input
                className="compose-title"
                maxLength="120"
                placeholder="Give your thought a title..."
                value={composer.title}
                onChange={(event) => setComposer({ ...composer, title: event.target.value })}
                required
                aria-label="Post title"
              />
              <textarea
                maxLength="5000"
                placeholder="Write it out. Big ideas, tiny moments, half-formed thoughts — all welcome."
                value={composer.content}
                onChange={(event) => setComposer({ ...composer, content: event.target.value })}
                required
                aria-label="Post content"
                rows="3"
              />
              <div className="compose-footer">
                <span className="compose-hint"><span className="hint-spark">✳</span> Keep it kind. Keep it real.</span>
                <button className="primary-button" type="submit" disabled={posting || !composer.title.trim() || !composer.content.trim()}>
                  <Icon name="plus" size={17} /> {posting ? 'Sharing…' : 'Share a thought'}
                </button>
              </div>
            </form>
          </section>
        )}

        {feedError && (
          <div className="notice error-notice" role="alert">
            <span>{feedError}</span>
            <button onClick={() => { setFeedError(''); loadPosts(); }}>Try again</button>
          </div>
        )}

        <section className="post-list" aria-label="Community posts">
          {loading ? (
            <div className="empty-state"><span className="loading-orbit" /><p>Finding the good stuff…</p></div>
          ) : visiblePosts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-illustration"><Icon name={showSaved ? 'bookmark' : 'spark'} size={28} /></span>
              <h2>{showSaved ? 'Nothing tucked away yet' : query ? 'No thoughts found' : 'A fresh page'}</h2>
              <p>{showSaved ? 'Save a post you love and it’ll be waiting here.' : query ? 'Try another search or clear the search field.' : 'Be the first to leave a little something for the community.'}</p>
            </div>
          ) : visiblePosts.map((post, index) => {
            const author = post.author || { name: `Member ${post.user_id || ''}`, id: post.user_id };
            const comments = post.comments || [];
            const isExpanded = expanded[post.id];
            const isSaved = savedIds.includes(post.id);
            const canDelete = session?.user?.id === post.user_id;
            return (
              <article className="post-card" key={post.id} style={{ '--card-index': index }}>
                <div className="post-header">
                  <Avatar name={author.name} id={author.id || post.user_id} />
                  <div className="post-author">
                    <strong>{author.name}</strong>
                    <span>{timeAgo(post.created_at)} <span className="post-separator">·</span> <span className="post-public">Community</span></span>
                  </div>
                  <div className="post-menu">
                    {canDelete && (
                      <button className="icon-button delete-button" aria-label="Delete post" title="Delete post" onClick={() => removePost(post.id)}>
                        <Icon name="dots" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="post-copy">
                  <h2>{post.title}</h2>
                  <p>{post.content}</p>
                </div>
                <div className="post-actions">
                  <button className={`post-action ${isExpanded ? 'action-active' : ''}`} onClick={() => setExpanded((current) => ({ ...current, [post.id]: !current[post.id] }))}>
                    <Icon name="message" size={18} />
                    <span>{comments.length} {comments.length === 1 ? 'reply' : 'replies'}</span>
                  </button>
                  <span className="action-spacer" />
                  <button className={`post-action save-action ${isSaved ? 'action-active' : ''}`} onClick={() => toggleSaved(post.id)} aria-label={isSaved ? 'Remove saved post' : 'Save post'}>
                    <Icon name="bookmark" size={18} />
                    <span>{isSaved ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
                {isExpanded && (
                  <div className="comments-panel">
                    {comments.length > 0 ? (
                      <div className="comment-list">
                        {comments.map((comment) => {
                          const commentAuthor = comment.author || { name: `Member ${comment.user_id || ''}`, id: comment.user_id };
                          return (
                            <div className="comment" key={comment.id}>
                              <Avatar name={commentAuthor.name} id={commentAuthor.id || comment.user_id} size="small" />
                              <div className="comment-bubble">
                                <div className="comment-heading"><strong>{commentAuthor.name}</strong><span>{timeAgo(comment.created_at)}</span></div>
                                <p>{comment.content}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="no-comments">No replies yet. Want to get the conversation going?</p>
                    )}
                    <form className="comment-form" onSubmit={(event) => submitComment(event, post.id)}>
                      {session ? <Avatar name={session.user?.name} id={session.user?.id} size="small" /> : <div className="avatar avatar-guest avatar-small"><Icon name="spark" size={14} /></div>}
                      <input
                        value={commentDrafts[post.id] || ''}
                        onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                        placeholder={session ? 'Add something kind...' : 'Sign in to join the conversation'}
                        maxLength="1000"
                        aria-label="Write a reply"
                        onFocus={() => { if (!session) requireSession(); }}
                      />
                      <button type="submit" disabled={commentBusy[post.id] || !(commentDrafts[post.id] || '').trim()} aria-label="Send reply">
                        <Icon name="arrow" size={17} />
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
        </section>
        <footer className="feed-footer"><span className="brand-mark brand-mark-small"><span /><span /><span /></span> You’re all caught up. Go make something good.</footer>
      </main>

      <aside className="right-sidebar">
        <div className="right-topbar">
          {session ? (
            <div className="profile-chip">
              <Avatar name={session.user?.name} id={session.user?.id} size="small" />
              <div><strong>{session.user?.name}</strong><span>Here for the good stuff</span></div>
              <button className="icon-button logout-button" onClick={logout} aria-label="Sign out"><Icon name="logout" size={17} /></button>
            </div>
          ) : (
            <div className="auth-actions">
              <button className="text-button" onClick={() => { setAuthMode('login'); setAuthError(''); setAuthOpen(true); }}>Log in</button>
              <button className="primary-button join-button" onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthOpen(true); }}>Join us <Icon name="arrow" size={15} /></button>
            </div>
          )}
        </div>
        <section className="welcome-card">
          <span className="welcome-stamp"><Icon name="spark" size={17} /></span>
          <span className="eyebrow">A NOTE FROM US</span>
          <h2>Less scrolling.<br /><em>More feeling.</em></h2>
          <p>No hot takes. No highlight reels. Just people being people, one thought at a time.</p>
          <div className="welcome-rule" />
          <div className="welcome-signoff"><span>glad you’re here</span><span className="welcome-flower">✳</span></div>
        </section>
        <section className="community-card">
          <div className="section-heading"><div><span className="eyebrow">THE VIBE</span><h3>Our little corner</h3></div><span className="community-star">✳</span></div>
          <div className="community-stats">
            <div><strong>{posts.length}</strong><span>thoughts shared</span></div>
            <span className="stats-divider" />
            <div><strong>{new Set(posts.map((post) => post.user_id)).size}</strong><span>voices here</span></div>
          </div>
          <div className="community-message"><span className="online-indicator" /> A good day to say something.</div>
        </section>
        <section className="kindness-card">
          <span className="kindness-icon">♡</span>
          <p>“The internet could use a little more <em>you</em>.”</p>
          <span className="kindness-caption">A GENTLE REMINDER</span>
        </section>
        <div className="right-footer"><span>ABOUT</span><span>COMMUNITY GUIDELINES</span><span>© DAYBOOK 2026</span></div>
      </aside>

      {authOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="icon-button modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><Icon name="close" /></button>
            <span className="modal-mark"><span className="brand-mark"><span /><span /><span /></span></span>
            <span className="eyebrow">YOUR CORNER OF THE INTERNET</span>
            <h2 id="auth-title">{authMode === 'signup' ? 'Come on in.' : 'Welcome back.'}</h2>
            <p className="modal-intro">{authMode === 'signup' ? 'Make a little space for yourself. You belong here.' : 'We saved you a seat.'}</p>
            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === 'signup' && (
                <label>Your name<input autoComplete="name" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} required maxLength="80" /></label>
              )}
              <label>Email address<input type="email" autoComplete="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} required /></label>
              <label>Password<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} required minLength="8" /></label>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="primary-button auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'One moment…' : authMode === 'signup' ? 'Create your account' : 'Log in'}</button>
            </form>
            <p className="auth-switch">
              {authMode === 'signup' ? 'Already have a little corner here?' : 'New around here?'}
              <button onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError(''); }}>
                {authMode === 'signup' ? 'Log in' : 'Create an account'}
              </button>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
