import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Read the AASA file from public directory
    const filePath = join(process.cwd(), 'public', '.well-known', 'apple-app-site-association');
    const fileContent = await readFile(filePath, 'utf-8');
    
    // Parse to validate JSON
    const json = JSON.parse(fileContent);
    
    // Return with correct content type (Apple requires application/json)
    return NextResponse.json(json, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error serving apple-app-site-association:', error);
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }
}

