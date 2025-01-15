import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { FinancialAnalyzer } from '@/app/services/FinancialAnalyzer';
import { z } from 'zod';

// Schema for request validation
const requestSchema = z.object({
  fileId: z.string(),
  accessToken: z.string(),
  query: z.string(),
});

export async function POST(req: Request) {
  try {
    // Validate request body
    const body = await req.json();
    console.log('Analyzing request received for file:', body.fileId);
    
    const { fileId, accessToken, query } = requestSchema.parse(body);

    // Initialize Google Drive client
    const drive = google.drive({ version: 'v3' });
    console.log('Fetching file content from Drive...');

    // Create auth client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    // Download file from Google Drive
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
        auth: auth
      },
      { responseType: 'arraybuffer' }
    );

    console.log('File downloaded successfully');

    if (!response.data) {
      throw new Error('No file data received from Google Drive');
    }

    // Convert array buffer to Buffer
    const fileBuffer = Buffer.from(new Uint8Array(response.data as ArrayBuffer));
    console.log('File buffer created, size:', fileBuffer.length);

    // Extract and analyze the data
    console.log('Extracting data from file...');
    const metrics = await FinancialAnalyzer.extractData(fileBuffer);
    console.log('Data extracted:', Object.keys(metrics));

    console.log('Analyzing data with query:', query);
    const analysis = await FinancialAnalyzer.analyzeData(metrics, query);
    console.log('Analysis completed');

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Detailed error response
    let errorMessage = 'Failed to analyze file';
    if (error instanceof z.ZodError) {
      errorMessage = 'Invalid request format: ' + error.errors.map(e => e.message).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
