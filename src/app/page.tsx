"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { store, Gallery } from "@/lib/store";
import { User } from "firebase/auth";

export default function GalleriesHome() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const [theme, setTheme] = useState("light");
  
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [newGalleryName, setNewGalleryName] = useState("");
  
  const [showGithubDropdown, setShowGithubDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 1000);
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(currentTheme);
    document.documentElement.setAttribute("data-theme", currentTheme);

    let unsubscribeGalleries: () => void;

    // Listen to Firebase Auth
    const unsubscribeAuth = store.onAuthChange((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        // Subscribe to ONLY this user's galleries
        unsubscribeGalleries = store.subscribeToGalleries(currentUser.uid, (data) => {
          setGalleries(data);
        });
      } else {
        setGalleries([]);
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribeAuth();
      if (unsubscribeGalleries) unsubscribeGalleries();
    };
  }, []);

  const handleLogin = async () => {
    await store.login();
  };

  const handleLogout = async () => {
    await store.logout();
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleCreateGallery = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGalleryName.trim() || !user) return;
    
    await store.createGallery(user.uid, newGalleryName.trim());
    setNewGalleryName("");
  };

  const [galleryToDelete, setGalleryToDelete] = useState<string | null>(null);

  const confirmDeleteGallery = async () => {
    if (galleryToDelete) {
      await store.deleteGallery(galleryToDelete);
      setGalleryToDelete(null);
    }
  };

  const handleDeleteGallery = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    setGalleryToDelete(id);
  };

  return (
    <>
      {/* Intro Screen */}
      <div className={`intro-screen ${!showIntro ? "hidden" : ""}`}>
        <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/logo.png" alt="Galax Studios" style={{ height: '50px', width: 'auto', filter: theme === 'dark' ? 'invert(1)' : 'none', objectFit: 'contain', zIndex: 2 }} />
          <div style={{ position: 'absolute', inset: 0, border: '1px solid var(--border-light)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: '100vh', opacity: showIntro ? 0 : 1, transition: "opacity var(--transition-slow)" }}>
        
        {/* LEFT SIDEBAR (Fixed) */}
        <aside style={{
          width: '300px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          borderRight: '1px solid var(--border-light)',
          background: 'var(--bg-primary)'
        }}>
          {/* Top: Logo & Theme Toggle */}
          <div style={{ marginBottom: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <a href="/" style={{ textDecoration: 'none', color: 'var(--text-primary)', display: 'block' }}>
                <img src="/logo.png" alt="Galax Studios" style={{ height: '65px', width: 'auto', filter: theme === 'dark' ? 'invert(1)' : 'none', objectFit: 'contain' }} />
              </a>
            </div>
            
            {/* Auth Toggle removed from sidebar */}
          </div>

          {/* Middle: Galleries List */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }}>

            {/* Create Gallery Form (Logged in Only) */}
            {user && (
              <form onSubmit={handleCreateGallery} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                <input 
                  type="text" 
                  placeholder="+ New Gallery" 
                  value={newGalleryName}
                  onChange={(e) => setNewGalleryName(e.target.value)}
                  required
                  style={{
                    padding: '0.5rem 0',
                    border: 'none',
                    borderBottom: '1px solid var(--border-light)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    width: '100%',
                    outline: 'none',
                    fontFamily: 'inherit',
                    fontWeight: 300,
                    fontSize: '0.85rem'
                  }}
                />
              </form>
            )}

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {galleries.map(g => (
                <li key={g.id}>
                  <button 
                    onClick={() => router.push(`/gallery/${g.id}`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'opacity var(--transition-fast)',
                      opacity: 0.7
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                  >
                    {g.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom: Custom Footer Rules */}
          <footer style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-light)' }}>
            
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Developed by<br />Chaniru Weerasinghe
            </p>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative' }}>
              
              {/* GitHub Hover Dropdown Wrapper */}
              <div 
                onMouseEnter={() => setShowGithubDropdown(true)} 
                onMouseLeave={() => setShowGithubDropdown(false)}
                style={{ position: 'relative', cursor: 'pointer' }}
              >
                {/* Github Icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--text-primary)">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>

                {/* Dropdown Menu */}
                {showGithubDropdown && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '10px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-md)',
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    minWidth: '150px',
                    zIndex: 100
                  }}>
                    <a href="https://github.com/ChaniruWeerasinghe" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.75rem', opacity: 0.8 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}>
                      Current (Latest)
                    </a>
                    <a href="https://github.com/Chanii2024" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.75rem', opacity: 0.8 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}>
                      Legacy (Old)
                    </a>
                  </div>
                )}
              </div>

              {/* LinkedIn */}
              <a href="https://www.linkedin.com/in/chaniru-weerasinghe-36aa2a326/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', opacity: 0.7 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </a>

              {/* Instagram */}
              <a href="https://www.instagram.com/chaniruweerasinghe" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', opacity: 0.7 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              
              {/* Facebook */}
              <a href="https://web.facebook.com/Chanii2003/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', opacity: 0.7 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
              </a>

            </div>
          </footer>
        </aside>

        {/* RIGHT SIDE: Dynamic Masonry Grid of Gallery Cards */}
        <main style={{ flex: 1, padding: '2vw', position: 'relative' }}>
          
          {/* Top Right Controls (Dark Mode + Profile) */}
          <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 100, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            
            {/* Dark Mode Toggle */}
            <button 
              onClick={toggleTheme} 
              title="Toggle Theme"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                width: '45px',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: '0', 
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-primary)'; e.currentTarget.style.transform = theme === 'dark' ? 'rotate(180deg) scale(1.05)' : 'rotate(0deg) scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)'; }}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>

            {/* Profile Dropdown */}
            {user && (
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-light)',
                    padding: '0.15rem',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    width: '45px',
                    height: '45px',
                    transition: 'border-color 0.3s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                >
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                </button>

                {showProfileDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.75rem)',
                    right: 0,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    padding: '0.75rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    minWidth: '150px',
                    borderRadius: '8px',
                    zIndex: 200
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, padding: '0 0.25rem' }}>{user.displayName}</span>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />
                    <button 
                      onClick={() => { setShowProfileDropdown(false); handleLogout(); }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: '0.25rem'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!authLoading && !user ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '3.5rem', fontWeight: 300, marginBottom: '1.5rem', letterSpacing: '-1.5px', color: 'var(--text-primary)' }}>Welcome to Galax</h2>
              <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '3rem', maxWidth: '500px', lineHeight: 1.6, fontWeight: 300 }}>
                A premium, ultra-fast portfolio manager for high-end photography studios. Sign in to host, manage, and share your galleries with clients.
              </p>
              
              <button 
                onClick={handleLogin} 
                style={{
                  background: '#ffffff',
                  border: '1px solid #dadce0',
                  color: '#3c4043',
                  fontSize: '1rem',
                  fontWeight: 500,
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3)',
                  transition: 'background-color 0.2s',
                  fontFamily: 'Roboto, arial, sans-serif'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
              >
                <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          ) : galleries.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ fontWeight: 300 }}>Create your first gallery on the left to get started.</p>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gridAutoRows: '180px', 
              gap: '12px',
              gridAutoFlow: 'dense'
            }}>
              {galleries.map((gallery, index) => {
                // Pseudo-random deterministic sizing based on index so it doesn't flicker
                const isWide = index % 3 === 0;
                const isTall = index % 4 === 0 || index % 5 === 0;
                
                return (
                  <div 
                    key={gallery.id} 
                    className="masonry-item"
                    onClick={() => router.push(`/gallery/${gallery.id}`)}
                    style={{ 
                      gridColumn: isWide ? 'span 2' : 'span 1',
                      gridRow: isTall ? 'span 2' : 'span 1',
                      position: 'relative'
                    }}
                  >
                    <div style={{ 
                      width: '100%', 
                      height: '100%', 
                      background: `linear-gradient(135deg, var(--border-light), var(--bg-secondary))`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)'
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </div>
                    
                    <div className="masonry-item-overlay" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 80%)', opacity: 1, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '2rem' }}>
                      <span style={{ fontWeight: 500, fontSize: "1.5rem", letterSpacing: '-0.5px' }}>{gallery.name}</span>
                      <span style={{ fontWeight: 300, fontSize: "0.85rem", opacity: 0.8, marginTop: '0.25rem' }}>{gallery.tabs.length} Events</span>
                      
                      {user && user.uid === gallery.userId && (
                        <button 
                          onClick={(e) => handleDeleteGallery(e, gallery.id)}
                          style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            background: 'rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(4px)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            transition: 'background var(--transition-fast)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.4)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
      
      {/* Delete Confirmation Modal */}
      {galleryToDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '2rem', border: '1px solid var(--border-light)', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 400, color: 'var(--text-primary)' }}>Delete Gallery</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete this gallery? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                onClick={() => setGalleryToDelete(null)}
                style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteGallery}
                style={{ padding: '0.5rem 1rem', background: '#e53935', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
