import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const { folderLink } = await req.json();

    if (!folderLink) {
      return NextResponse.json({ error: 'Folder link is required' }, { status: 400 });
    }

    // Extract folder ID from typical Google Drive links
    // Formats: 
    // https://drive.google.com/drive/folders/1abc123...?usp=sharing
    // https://drive.google.com/open?id=1abc123...
    const folderIdMatch = folderLink.match(/folders\/([a-zA-Z0-9-_]+)/) || folderLink.match(/id=([a-zA-Z0-9-_]+)/);
    
    if (!folderIdMatch || !folderIdMatch[1]) {
      return NextResponse.json({ error: 'Invalid Google Drive folder link' }, { status: 400 });
    }

    const folderId = folderIdMatch[1];
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Google API Key is not configured on the server.' }, { status: 500 });
    }

    const drive = google.drive({ version: 'v3', auth: apiKey });

    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`,
      fields: 'files(id, name, webContentLink, thumbnailLink, mimeType)',
      pageSize: 50,
    });

    const files = response.data.files || [];

    // Format the response for our frontend
    const media = files.map(file => {
      const isVideo = file.mimeType?.includes('video/');
      
      return {
        id: file.id,
        name: file.name,
        // The direct view link for public google drive media
        url: `https://drive.google.com/uc?export=view&id=${file.id}`,
        thumbnail: file.thumbnailLink,
        isVideo,
        mimeType: file.mimeType
      };
    });

    return NextResponse.json({ media });

  } catch (error: any) {
    console.error('Google Drive API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch media from Google Drive' }, { status: 500 });
  }
}
