import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { folderId, destinationId } = await req.json();
    const accessToken = req.headers.get('Authorization')?.split(' ')[1];

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!folderId || !destinationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Call Google Drive API to move the folder
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?addParents=${destinationId}&removeParents=root`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to move folder in Google Drive');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error moving folder:', error);
    return NextResponse.json(
      { error: 'Failed to move folder' },
      { status: 500 }
    );
  }
}
