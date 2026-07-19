"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { store, Gallery, EventTab } from "@/lib/store";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Set auth state
    setIsAdmin(store.isAdmin());

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
      unsubscribe();
    };
  }, [galleryId, router]);

  const handleDriveSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!driveLink || !activeTab) return;

    setIsDriveLoading(true);
    await store.updateTabLink(galleryId, activeTab.id, driveLink);
    setError("");

    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderLink: driveLink }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load media");
      setMedia(data.media);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleAddTab = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTabName) return;
    await store.addTab(galleryId, newTabName);
    setNewTabName("");
  };

  const handleTabSwitch = (tab: EventTab) => {
    setActiveTab(tab);
    setDriveLink(tab.driveLink || "");
    setMedia([]); 
  };

  const downloadFile = (url: string, filename: string) => {
    const downloadUrl = url.replace('export=view', 'export=download');
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = downloadUrl;
    document.body.appendChild(iframe);
    setTimeout(() => { document.body.removeChild(iframe); }, 5000);
  };

  const handleDownloadAll = () => {
    if (media.length === 0) return;
    media.forEach((item, index) => {
      setTimeout(() => { downloadFile(item.url, item.name); }, index * 800);
    });
  };

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
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Gallery link copied to clipboard! Share this URL with your clients.");
            }}
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
            Share Gallery
          </button>
        </div>
      </nav>

      <main style={{ padding: '0 4vw 6rem 4vw' }}>
        {isAdmin && (
          <div style={{ marginBottom: '3rem', background: 'var(--bg-secondary)', padding: '1.5rem', border: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Admin Controls (Hidden from Guests)</h3>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <form onSubmit={handleDriveSubmit} style={{ flex: '1 1 300px', display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="url" 
                  placeholder="Paste Google Drive Folder Link" 
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
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
                <button type="submit" disabled={isDriveLoading} style={{ padding: '0.75rem 1.5rem', background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                  {isDriveLoading ? 'Syncing...' : 'Sync Folder'}
                </button>
              </form>
              
              <form onSubmit={handleAddTab} style={{ flex: '0 1 300px', display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="New Tab Name" 
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
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
                <button type="submit" style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-light)', cursor: 'pointer', fontSize: '0.85rem' }}>
                  + Add Tab
                </button>
              </form>
            </div>
          </div>
        )}
        
        {error && <p style={{ color: '#e53935', marginBottom: '2rem' }}>{error}</p>}

        <div className="masonry-grid">
          {media.map((item) => (
            <div className="masonry-item" key={item.id}>
              {item.isVideo ? (
                 <video src={item.url} muted loop playsInline autoPlay style={{ width: '100%', display: 'block' }} />
              ) : (
                <img src={item.thumbnail || item.url} alt={item.name || "Gallery media"} loading="lazy" />
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
          ))}
        </div>
      </main>

      {/* Floating Filter Tabs & Actions */}
      {gallery.tabs.length > 0 && (
        <div className="floating-tabs-container">
          <div className="floating-tabs">
            {gallery.tabs.map((tab) => (
              <button 
                key={tab.id} 
                className={`tab-btn ${activeTab?.id === tab.id ? "active" : ""}`}
                onClick={() => handleTabSwitch(tab)}
              >
                {tab.name}
              </button>
            ))}
            
            {/* Divider */}
            {media.length > 0 && (
              <div style={{ width: '1px', background: 'var(--border-light)', margin: '0.25rem 0.5rem' }}></div>
            )}
            
            {/* Download All Button */}
            {media.length > 0 && (
              <button 
                className="tab-btn"
                onClick={handleDownloadAll}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                title="Download all media in this tab"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download All
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
