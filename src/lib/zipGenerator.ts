import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { EventTab, Gallery } from './store';

interface MediaItem {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  isVideo: boolean;
}

// Helper to fetch file as Blob through our proxy
const fetchBlob = async (url: string): Promise<Blob> => {
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return await response.blob();
};

export const downloadTabAsZip = async (
  tab: EventTab, 
  media: MediaItem[], 
  onProgress?: (progress: string) => void
) => {
  if (media.length === 0) return;
  
  onProgress?.('Preparing ZIP...');
  const zip = new JSZip();
  const folder = zip.folder(tab.name || 'Tab');

  let completed = 0;
  const total = media.length;

  for (const item of media) {
    try {
      onProgress?.(`Fetching ${completed + 1}/${total}...`);
      const downloadUrl = item.url.replace('export=view', 'export=download');
      const blob = await fetchBlob(downloadUrl);
      folder?.file(item.name, blob);
      completed++;
    } catch (e) {
      console.error(`Failed to add ${item.name} to zip:`, e);
    }
  }

  onProgress?.('Generating ZIP file (this may take a minute)...');
  const content = await zip.generateAsync({ type: 'blob' });
  
  onProgress?.('Downloading...');
  saveAs(content, `${tab.name || 'Gallery_Tab'}.zip`);
  onProgress?.(''); // Clear progress
};

export const downloadGalleryAsZip = async (
  gallery: Gallery, 
  onProgress?: (progress: string) => void
) => {
  if (!gallery.tabs || gallery.tabs.length === 0) return;
  
  onProgress?.('Preparing Gallery ZIP...');
  const zip = new JSZip();

  let totalFiles = 0;
  let completedFiles = 0;

  // First, fetch the media list for EVERY tab
  const tabsWithMedia = await Promise.all(
    gallery.tabs.map(async (tab) => {
      if (!tab.driveLink) return { tab, media: [] };
      try {
        const res = await fetch("/api/drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderLink: tab.driveLink }),
        });
        if (!res.ok) return { tab, media: [] };
        const data = await res.json();
        totalFiles += data.media.length;
        return { tab, media: data.media as MediaItem[] };
      } catch {
        return { tab, media: [] };
      }
    })
  );

  if (totalFiles === 0) {
    onProgress?.('');
    return;
  }

  // Now fetch every file and add to corresponding folder
  for (const { tab, media } of tabsWithMedia) {
    if (media.length === 0) continue;
    
    const folder = zip.folder(tab.name || 'Tab');
    
    for (const item of media) {
      try {
        onProgress?.(`Fetching ${completedFiles + 1}/${totalFiles}...`);
        const downloadUrl = item.url.replace('export=view', 'export=download');
        const blob = await fetchBlob(downloadUrl);
        folder?.file(item.name, blob);
        completedFiles++;
      } catch (e) {
        console.error(`Failed to add ${item.name} to zip:`, e);
      }
    }
  }

  onProgress?.('Generating massive ZIP file (this may take a few minutes)...');
  const content = await zip.generateAsync({ type: 'blob' });
  
  onProgress?.('Downloading...');
  saveAs(content, `${gallery.name.replace(/\\s+/g, '_')}_Full_Gallery.zip`);
  onProgress?.(''); // Clear progress
};
