"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { store, Gallery } from "@/lib/store";

export default function GalleriesHome() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const [theme, setTheme] = useState("light");
  
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [newGalleryName, setNewGalleryName] = useState("");
  
  const [showGithubDropdown, setShowGithubDropdown] = useState(false);
  
  // Auth State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    // Show intro screen
    const timer = setTimeout(() => setShowIntro(false), 1000);
    
    // Set theme
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(currentTheme);
    document.documentElement.setAttribute("data-theme", currentTheme);

    // Load Auth State
    setIsAdmin(store.isAdmin());

    // Subscribe to Firebase Galleries Real-time
    const unsubscribe = store.subscribeToGalleries((data) => {
      setGalleries(data);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (store.login(pin)) {
      setIsAdmin(true);
      setShowLogin(false);
      setPin("");
    } else {
      alert("Incorrect PIN");
    }
  };

  const handleLogout = () => {
    store.logout();
    setIsAdmin(false);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleCreateGallery = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGalleryName.trim()) return;
    
    // UI will optimistically update via Firebase Snapshot
    await store.createGallery(newGalleryName.trim());
    
    setNewGalleryName("");
  };

  const handleDeleteGallery = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    if (confirm("Are you sure you want to delete this gallery?")) {
      await store.deleteGallery(id);
    }
  };

  return (
    <>
      {/* Intro Screen */}
      <div className={`intro-screen ${!showIntro ? "hidden" : ""}`}>
        <h1 className="intro-logo">Galax</h1>
        <div className="loading-circle"></div>
      </div>

      <div style={{ display: 'flex', minHeight: '100vh', opacity: showIntro ? 0 : 1, transition: "opacity var(--transition-slow)" }}>
        
        {/* LEFT SIDEBAR (Fixed) */}
        <aside style={{
          flex: '0 0 220px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '3rem 1.5rem',
          borderRight: '1px solid var(--border-light)',
          background: 'var(--bg-primary)'
        }}>
          {/* Top: Logo & Theme Toggle */}
          <div style={{ marginBottom: '3rem' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Galax.Studios
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.5rem' }}>
              Portfolio
            </p>
            
            <button 
              onClick={toggleTheme} 
              style={{
                background: 'transparent',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                padding: '0.25rem 0.75rem',
                cursor: 'pointer',
                borderRadius: '0',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-light)'; }}
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            
            {/* Auth Toggle */}
            <button 
              onClick={() => isAdmin ? handleLogout() : setShowLogin(true)} 
              style={{
                background: 'transparent',
                border: '1px solid var(--border-light)',
                color: isAdmin ? 'var(--bg-primary)' : 'var(--text-secondary)',
                backgroundColor: isAdmin ? 'var(--accent)' : 'transparent',
                fontSize: '0.75rem',
                padding: '0.25rem 0.75rem',
                cursor: 'pointer',
                borderRadius: '0',
                transition: 'all var(--transition-fast)',
                marginLeft: '0.5rem'
              }}
            >
              {isAdmin ? "Logout" : "Admin"}
            </button>
            
            {/* Login Prompt */}
            {showLogin && !isAdmin && (
              <form onSubmit={handleLogin} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="password" 
                  placeholder="PIN" 
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  autoFocus
                  style={{
                    padding: '0.25rem 0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    width: '60px',
                    outline: 'none',
                    fontSize: '0.75rem'
                  }}
                />
                <button type="submit" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', cursor: 'pointer' }}>Unlock</button>
                <button type="button" onClick={() => setShowLogin(false)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>Cancel</button>
              </form>
            )}
          </div>

          {/* Middle: Galleries List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Create Gallery Form (Admin Only) */}
            {isAdmin && (
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
        <main style={{ flex: 1, padding: '2vw' }}>
          {galleries.length === 0 ? (
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
                      
                      {isAdmin && (
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
    </>
  );
}
