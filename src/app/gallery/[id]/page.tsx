"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const galleryId = params.id as string;

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [activeTab, setActiveTab] = useState<EventTab | null>(null);
  const [theme, setTheme] = useState("light");

  // Media Quality State
  const [mediaQuality, setMediaQuality] = useState<"standard" | "high" | "original">("high");
  const [showQualityMenu, setShowQualityMenu] = useState(false);

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

  // Custom Overlays State
  const [toastMessage, setToastMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tabToDelete, setTabToDelete] = useState<string | null>(null);

  // Lightbox State
  const [lightboxItem, setLightboxItem] = useState<GalleryMedia | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const getQualityUrl = (url: string, isLightbox = false) => {
    if (!url) return url;
    // Google Drive URLs often end with =s220 or =w...-h...
    // standard: s800 (fast loading)
    // high: s1600 (sharp)
    // original: s0 (full resolution)
    let sizeParam = "=s1600";
    if (mediaQuality === "standard") sizeParam = "=s800";
    if (mediaQuality === "original") sizeParam = "=s0";
    if (isLightbox && mediaQuality === "standard") sizeParam = "=s1600"; // Lightbox should always be at least decent

    return url.replace(/=s\d+|=w\d+-h\d+/, sizeParam);
  };

  const openLightbox = (item: GalleryMedia, index: number) => {
    setLightboxItem(item);
    setLightboxIndex(index);
  };

  const closeLightbox = () => setLightboxItem(null);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("galax_theme", newTheme);
  };

  const lightboxPrev = () => {
    const newIndex = (lightboxIndex - 1 + media.length) % media.length;
    setLightboxItem(media[newIndex]);
    setLightboxIndex(newIndex);
  };

  const lightboxNext = () => {
    const newIndex = (lightboxIndex + 1) % media.length;
    setLightboxItem(media[newIndex]);
    setLightboxIndex(newIndex);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  useEffect(() => {
    // Listen to Firebase Auth
    const unsubscribeAuth = store.onAuthChange((currentUser) => {
      setUser(currentUser);
    });

    const savedTheme = localStorage.getItem("galax_theme");
    const currentTheme = savedTheme || document.documentElement.getAttribute("data-theme") || "light";
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
        const urlTabId = searchParams.get("tab");
        setActiveTab((prev) => {
          if (!prev || !data.tabs.find(t => t.id === prev.id)) {
            let targetTab = data.tabs[0];
            if (urlTabId) {
              const found = data.tabs.find(t => t.id === urlTabId);
              if (found) targetTab = found;
            }
            setDriveLink(targetTab.driveLink || "");
            return targetTab;
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
  }, [galleryId, router, searchParams]);
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

  const confirmDeleteTab = (tabId: string) => {
    setTabToDelete(tabId);
    setShowDeleteConfirm(true);
  };

  const executeDeleteTab = async () => {
    if (!tabToDelete) return;
    await store.deleteTab(galleryId, tabToDelete);
    if (activeTab?.id === tabToDelete) {
      setActiveTab(null);
      setDriveLink("");
      setMedia([]);
    }
    setShowDeleteConfirm(false);
    setTabToDelete(null);
  };

  const downloadFile = (fileId: string, filename: string) => {
    // Route through proxy which sets Content-Disposition: attachment — forces browser to download not open
    const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(driveDownloadUrl)}&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // handleDownloadAll has been removed in favor of ZIP downloading

  if (!gallery) return <div style={{ padding: '5rem', fontWeight: 300 }}>Loading Gallery...</div>;

  return (
    <>
      <nav className="gallery-nav" style={{ padding: '2rem 4vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            onClick={() => router.push("/")}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 0',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Galleries
          </button>
          <h1 className="gallery-title" style={{ fontSize: '2.5rem', fontWeight: 300, letterSpacing: '-1px' }}>{gallery.name}</h1>
        </div>
        <div className="gallery-nav-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
              borderRadius: '50%',
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

          {/* Quality Selector */}
          {media.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                title="Media Quality"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  borderRadius: '24px',
                  fontSize: '0.85rem',
                  transition: 'all var(--transition-fast)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--text-primary)'; e.currentTarget.style.color = 'var(--bg-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              >
                <span>{mediaQuality === 'standard' ? 'Standard' : mediaQuality === 'high' ? 'High Quality' : 'Original'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {showQualityMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: '160px',
                  zIndex: 20,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <button
                    onClick={() => { setMediaQuality('standard'); setShowQualityMenu(false); }}
                    style={{ padding: '0.75rem 1rem', background: mediaQuality === 'standard' ? 'var(--bg-secondary)' : 'none', border: 'none', borderBottom: '1px solid var(--border-light)', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: mediaQuality === 'standard' ? '500' : '300' }}
                  >
                    Standard (Fastest)
                  </button>
                  <button
                    onClick={() => { setMediaQuality('high'); setShowQualityMenu(false); }}
                    style={{ padding: '0.75rem 1rem', background: mediaQuality === 'high' ? 'var(--bg-secondary)' : 'none', border: 'none', borderBottom: '1px solid var(--border-light)', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: mediaQuality === 'high' ? '500' : '300' }}
                  >
                    High Quality
                  </button>
                  <button
                    onClick={() => { setMediaQuality('original'); setShowQualityMenu(false); }}
                    style={{ padding: '0.75rem 1rem', background: mediaQuality === 'original' ? 'var(--bg-secondary)' : 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: mediaQuality === 'original' ? '500' : '300' }}
                  >
                    Original (Max Res)
                  </button>
                </div>
              )}
            </div>
          )}

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
                  borderRadius: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all var(--transition-fast)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--text-primary)'; e.currentTarget.style.color = 'var(--bg-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              >
                <span>Download</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
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
              showToast("Gallery link copied to clipboard!");
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
            <div className="admin-controls-panel" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 100%' }}>
                <form onSubmit={handleAddTab} className="admin-form" style={{ display: 'flex', gap: '0.5rem' }}>
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
                    onClick={() => confirmDeleteTab(activeTab.id)}
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

        {/* Media Counts & Quick Actions */}
        {media.length > 0 && !isDriveLoading && (
          <div style={{
            marginBottom: '1rem',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between', // Push download button to the right
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{media.filter(m => !m.isVideo).length} Images</span>
              <span>•</span>
              <span>{media.filter(m => m.isVideo).length} Videos</span>
            </div>

            {activeTab && (
              <button
                onClick={async () => { if (activeTab) await downloadTabAsZip(activeTab, media, setZipProgress); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  transition: 'all var(--transition-fast)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download Tab
              </button>
            )}
          </div>
        )}

        <div className="gallery-media-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gridAutoRows: '200px',
          gap: '16px',
          gridAutoFlow: 'dense',
          paddingBottom: '8rem'
        }}>
          {isDriveLoading ? (
            Array.from({ length: 12 }).map((_, index) => {
              let colSpan = 1;
              let rowSpan = 1;
              if (index % 11 === 0) { colSpan = 3; rowSpan = 2; }
              else if (index % 7 === 0) { colSpan = 2; rowSpan = 2; }
              else if (index % 5 === 0) { colSpan = 2; rowSpan = 1; }
              else if (index % 3 === 0) { colSpan = 1; rowSpan = 2; }
              return (
                <div
                  key={`skeleton-${index}`}
                  className="skeleton masonry-item"
                  style={{
                    gridColumn: `span ${colSpan}`,
                    gridRow: `span ${rowSpan}`,
                    margin: 0
                  }}
                />
              );
            })
          ) : media.map((item, index) => {
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
                onClick={(e) => {
                  if ((e.target as Element).closest('button') || (e.target as Element).closest('a')) return;
                  openLightbox(item, index);
                }}
                style={{
                  gridColumn: `span ${colSpan}`,
                  gridRow: `span ${rowSpan}`,
                  margin: 0,
                  cursor: 'pointer'
                }}
              >
                {item.isVideo ? (
                  <div style={{ width: '100%', height: '100%', position: 'relative', background: '#111' }}>
                    {item.thumbnail ? (
                      <img src={getQualityUrl(item.thumbnail)} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} referrerPolicy="no-referrer" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7"></polygon>
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                      </div>
                    )}
                    {/* Centered big play button */}
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%,-50%)',
                      background: 'rgba(255,255,255,0.15)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: '50%',
                      width: '52px', height: '52px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid rgba(255,255,255,0.5)',
                      color: 'white'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <img
                    src={item.thumbnail ? getQualityUrl(item.thumbnail) : item.url}
                    alt={item.name || "Gallery media"}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}

                <div className="masonry-item-overlay">
                  <span style={{ fontWeight: 400, fontSize: "1.1rem", display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    {item.name.replace(/\.[^/.]+$/, "")}
                    <a
                      href={`/api/proxy?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${item.id}`)}&filename=${encodeURIComponent(item.name)}`}
                      download={item.name}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
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
                        transition: 'background var(--transition-fast)',
                        textDecoration: 'none',
                        pointerEvents: 'auto'
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
                    </a>
                  </span>
                </div>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>{tab.name}</span>
                  {activeTab?.id === tab.id && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = new URL(window.location.href);
                        url.searchParams.set("tab", tab.id);
                        navigator.clipboard.writeText(url.toString());
                        showToast("Tab link copied!");
                      }}
                      style={{ padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '50%', background: 'rgba(0,0,0,0.15)', marginLeft: '4px' }}
                      title="Share this tab"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line>
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            ))}

            {/* Divider */}
          </div>
        </div>
      )}

      {/* Lightbox Overlay */}
      {lightboxItem && (
        <div
          onClick={closeLightbox}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Top Right Controls (Share & Close) */}
          <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.75rem', zIndex: 1 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // The URL for public sharing of a Google Drive file
                navigator.clipboard.writeText(`https://drive.google.com/file/d/${lightboxItem.id}/view`);
                showToast("File link copied!");
              }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%', width: '44px', height: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', cursor: 'pointer'
              }}
              title="Share File"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>
            <button
              onClick={closeLightbox}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%', width: '44px', height: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', cursor: 'pointer'
              }}
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          {/* Prev button */}
          {media.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
              className="lightbox-prev"
              style={{
                position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%', width: '48px', height: '48px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', cursor: 'pointer'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}

          {/* Next button */}
          {media.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
              className="lightbox-next"
              style={{
                position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%', width: '48px', height: '48px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', cursor: 'pointer'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}

          {/* Content area */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
          >
            {lightboxItem.isVideo ? (
              <iframe
                key={lightboxItem.id}
                src={`https://drive.google.com/file/d/${lightboxItem.id}/preview`}
                allow="autoplay; fullscreen"
                allowFullScreen
                style={{
                  width: 'min(85vw, 1100px)',
                  height: 'min(75vh, 620px)',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#000'
                }}
              />
            ) : (
              <img
                key={lightboxItem.id}
                src={lightboxItem.thumbnail ? lightboxItem.thumbnail.replace(/=s\d+/, '=s1600') : lightboxItem.thumbnail}
                alt={lightboxItem.name}
                referrerPolicy="no-referrer"
                style={{
                  maxWidth: 'min(88vw, 1200px)',
                  maxHeight: '82vh',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
                }}
              />
            )}
            {/* Caption */}
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'center' }}>
              {lightboxItem.name.replace(/\.[^/.]+$/, "")} &nbsp;·&nbsp; {lightboxIndex + 1} / {media.length}
            </p>
          </div>
        </div>
      )}

      {/* Custom Toast Overlay */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontWeight: 400,
          animation: 'slideUp 0.3s ease-out forwards',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Delete Tab</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete this tab? This will hide all images associated with it. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowDeleteConfirm(false); setTabToDelete(null); }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteTab}
                style={{
                  background: '#e53935',
                  border: 'none',
                  color: 'white',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)'
                }}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
