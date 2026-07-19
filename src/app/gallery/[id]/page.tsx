"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { store, Gallery, EventTab } from "@/lib/store";
import { User } from "firebase/auth";
import { downloadTabAsZip, downloadGalleryAsZip } from "@/lib/zipGenerator";

type GalleryMedia = {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  isVideo?: boolean;
};

export default function GalleryPage() {
  const params = useParams();
  const router = useRouter();
  const galleryId = params.id as string;
  
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [activeTab, setActiveTab] = useState<EventTab | null>(null);
  const [theme, setTheme] = useState("light");
  
  // Google Drive State
  const [driveLink, setDriveLink] = useState("");
  const [media, setMedia] = useState<GalleryMedia[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [zipProgress, setZipProgress] = useState("");
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  
  // Derived state for admin check to avoid stale closures and infinite effect loops
  const isAdmin = user && gallery ? user.uid === gallery.userId : false;
  
  const [newTabName, setNewTabName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Listen to Firebase Auth
    const unsubscribeAuth = store.onAuthChange((currentUser) => {
      setUser(currentUser);
    });

    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(currentTheme);
    document.documentElement.setAttribute("data-theme", currentTheme);

    // Subscribe to specific gallery
    const unsubscribe = store.subscribeToGallery(galleryId, (data) => {
      if (!data) {
        router.push("/");
        return;
      }
      
      setGallery(data);
      
      // If no active tab is set, or if the active tab was deleted, default to first tab
      if (data.tabs && data.tabs.length > 0) {
        setActiveTab((prev) => {
          if (!prev || !data.tabs.find(t => t.id === prev.id)) {
            setDriveLink(data.tabs[0].driveLink || "");
            return data.tabs[0];
          }
          return prev;
        });
      }
    });

    // Clean up cache and listener
    return () => {
      localStorage.removeItem("galax_drive_cache");
      unsubscribeAuth();
      unsubscribe();
    };
  }, [galleryId, router]);
  const [newTabDriveLink, setNewTabDriveLink] = useState("");

  useEffect(() => {
    if (activeTab?.driveLink) {
      let isMounted = true;
      const fetchMedia = async () => {
        setIsDriveLoading(true);
        setError("");
        try {
          const res = await fetch("/api/drive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderLink: activeTab.driveLink }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load media");
          if (isMounted) setMedia(data.media);
        } catch (err: any) {
          if (isMounted) setError(err.message);
        } finally {
          if (isMounted) setIsDriveLoading(false);
        }
      };
      fetchMedia();
      return () => { isMounted = false; };
    } else {
      setMedia([]);
    }
  }, [activeTab?.id, activeTab?.driveLink]);

  const handleDriveSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!driveLink || !activeTab) return;
    // Updating the tab link will trigger Firebase onSnapshot, 
    // which updates activeTab, which triggers the useEffect to fetch media!
    await store.updateTabLink(galleryId, activeTab.id, driveLink);
  };

  const handleAddTab = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTabName) return;
    
    const newTab = await store.addTab(galleryId, newTabName, newTabDriveLink);
    setNewTabName("");
    setNewTabDriveLink("");
    
    if (newTab) {
      setActiveTab(newTab);
      setDriveLink(newTab.driveLink || "");
    }
  };

  const handleTabSwitch = (tab: EventTab) => {
    if (activeTab?.id === tab.id) return;
    setActiveTab(tab);
    setDriveLink(tab.driveLink || "");
    setMedia([]); 
  };

  const handleDeleteTab = async (tabId: string) => {
    if (confirm("Are you sure you want to delete this tab?")) {
      await store.deleteTab(galleryId, tabId);
      if (activeTab?.id === tabId) {
        setActiveTab(null);
        setDriveLink("");
        setMedia([]);
      }
    }
  };

  const downloadFile = (url: string, filename: string) => {
    const downloadUrl = url.replace('export=view', 'export=download');
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = downloadUrl;
    document.body.appendChild(iframe);
    setTimeout(() => { document.body.removeChild(iframe); }, 5000);
  };

  // handleDownloadAll has been removed in favor of ZIP downloading

  if (!gallery) return <div style={{ padding: '5rem', fontWeight: 300 }}>Loading Gallery...</div>;

  return (
    <>
      <nav style={{ padding: '2rem 4vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={() => router.push("/")} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            ← Back to Galleries
          </button>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 300, letterSpacing: '-1px' }}>{gallery.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {gallery.tabs.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                style={{ 
                  background: 'transparent', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border-light)', 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.85rem', 
                  cursor: 'pointer',
                  borderRadius: '0'
                }}
              >
                Download ↓
              </button>
              {showDownloadMenu && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  right: 0, 
                  marginTop: '0.5rem', 
                  background: 'var(--bg-primary)', 
                  border: '1px solid var(--border-light)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  minWidth: '220px', 
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <button 
                    onClick={async () => { setShowDownloadMenu(false); if (activeTab) await downloadTabAsZip(activeTab, media, setZipProgress); }} 
                    style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid var(--border-light)', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  >
                    Download Current Tab
                  </button>
                  <button 
                    onClick={async () => { setShowDownloadMenu(false); await downloadGalleryAsZip(gallery, setZipProgress); }} 
                    style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  >
                    Download Entire Gallery (.zip)
                  </button>
                </div>
              )}
            </div>
          )}
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Gallery link copied to clipboard! Share this URL with your clients.");
            }}
            style={{ 
              background: 'var(--text-primary)', 
              color: 'var(--bg-primary)', 
              border: 'none', 
              padding: '0.5rem 1rem', 
              fontSize: '0.85rem', 
              cursor: 'pointer',
              borderRadius: '0'
            }}
          >
            Share Gallery
          </button>
        </div>
      </nav>

      {zipProgress && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'var(--text-primary)', color: 'var(--bg-primary)', padding: '1rem 2rem', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.9rem' }}>
          <div className="loading-circle" style={{ width: '20px', height: '20px', borderColor: 'var(--bg-primary)', borderTopColor: 'transparent' }}></div>
          {zipProgress}
        </div>
      )}

      <main style={{ padding: '0 4vw 6rem 4vw' }}>
        {isAdmin && (
          <div style={{ marginBottom: '3rem', background: 'var(--bg-secondary)', padding: '1.5rem', border: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Admin Controls (Hidden from Guests)</h3>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 100%' }}>
                <form onSubmit={handleAddTab} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="Tab Name (e.g. Weddings)" 
                    value={newTabName}
                    onChange={(e) => setNewTabName(e.target.value)}
                    required
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: '0.85rem'
                    }}
                  />
                  <input 
                    type="url" 
                    placeholder="Paste Google Drive Folder Link" 
                    value={newTabDriveLink}
                    onChange={(e) => setNewTabDriveLink(e.target.value)}
                    required
                    style={{
                      flex: 2,
                      padding: '0.75rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button type="submit" disabled={isDriveLoading} style={{ whiteSpace: 'nowrap', padding: '0.75rem 1.5rem', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {isDriveLoading ? 'Syncing...' : '+ Create Tab & Sync'}
                  </button>
                </form>
              </div>
              
              {/* Delete Active Tab Button */}
              {activeTab && (
                <div style={{ flex: '1 1 100%', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                  <button 
                    onClick={() => handleDeleteTab(activeTab.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #e53935',
                      color: '#e53935',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      padding: '0.5rem 1rem',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e53935'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e53935'; }}
                  >
                    Delete Current Tab ("{activeTab.name}")
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {error && <p style={{ color: '#e53935', marginBottom: '2rem' }}>{error}</p>}

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gridAutoRows: '200px', 
          gap: '16px',
          gridAutoFlow: 'dense',
          paddingBottom: '8rem'
        }}>
          {media.map((item, index) => {
            // 5 Distinct Image Styles (Width x Height spans)
            let colSpan = 1;
            let rowSpan = 1;

            if (index % 11 === 0) {
              colSpan = 3; rowSpan = 2; // Style 5: Feature Panorama
            } else if (index % 7 === 0) {
              colSpan = 2; rowSpan = 2; // Style 4: Large Square
            } else if (index % 5 === 0) {
              colSpan = 2; rowSpan = 1; // Style 2: Wide Landscape
            } else if (index % 3 === 0) {
              colSpan = 1; rowSpan = 2; // Style 3: Tall Portrait
            } else {
              colSpan = 1; rowSpan = 1; // Style 1: Standard
            }

            return (
              <div 
                className="masonry-item" 
                key={item.id}
                style={{
                  gridColumn: `span ${colSpan}`,
                  gridRow: `span ${rowSpan}`,
                  margin: 0 // Override masonry-item margin
                }}
              >
                {item.isVideo ? (
                  <video src={item.url} muted loop playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <img 
                    src={item.thumbnail || item.url} 
                    alt={item.name || "Gallery media"} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
              
              <div className="masonry-item-overlay">
                <span style={{ fontWeight: 400, fontSize: "1.1rem", display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  {item.name.replace(/\.[^/.]+$/, "")}
                  <button 
                    onClick={(e) => { e.stopPropagation(); downloadFile(item.url, item.name); }}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)',
                      transition: 'background var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.4)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    title="Download"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </button>
                </span>
              </div>
              
              {/* Premium Video Icon */}
              {item.isVideo && (
                <div style={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </main>

      {/* Floating Filter Tabs & Actions */}
      {gallery.tabs.length > 0 && (
        <div className="floating-tabs-container">
          <div className="floating-tabs">
            {gallery.tabs.map((tab) => (
              <div key={tab.id} style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
                <button 
                  className={`tab-btn ${activeTab?.id === tab.id ? "active" : ""}`}
                  onClick={() => handleTabSwitch(tab)}
                >
                  <span>{tab.name}</span>
                </button>
              </div>
            ))}
            
            {/* Divider */}
          </div>
        </div>
      )}
    </>
  );
}
