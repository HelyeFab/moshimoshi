import { NextRequest, NextResponse } from 'next/server';
import { TranscriptCacheManager } from '@/utils/transcriptCache';

interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'FILE_REQUIRED',
        message: 'No file uploaded'
      }, { status: 400 });
    }

    // Validate file size (10MB for free, 50MB for premium)
    const maxSize = 50 * 1024 * 1024; // 50MB max
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'File size exceeds limit'
      }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'INVALID_FILE_TYPE',
        message: 'Invalid file type. Please upload an audio or video file.'
      }, { status: 400 });
    }

    // Generate content ID for caching
    const contentId = TranscriptCacheManager.generateContentId({
      type: file.type.startsWith('video') ? 'video' : 'audio',
      fileName: file.name,
      fileSize: file.size
    });

    // Check cache first
    const cachedTranscript = await TranscriptCacheManager.getCachedTranscript(contentId);
    if (cachedTranscript) {
      console.log('Using cached transcript for uploaded file:', file.name);

      // Convert file to blob URL
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: file.type });

      return NextResponse.json({
        success: true,
        transcript: cachedTranscript.transcript,
        formattedTranscript: cachedTranscript.formattedTranscript,
        language: cachedTranscript.language,
        fromCache: true,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      });
    }

    // For MVP, we'll just return a placeholder transcript
    // In production, this would use a service like Google Speech-to-Text or Whisper API
    const placeholderTranscript: TranscriptLine[] = [
      {
        id: '1',
        text: 'Audio transcription will be available in the next update.',
        startTime: 0,
        endTime: 5,
        words: ['Audio', 'transcription', 'will', 'be', 'available', 'in', 'the', 'next', 'update']
      },
      {
        id: '2',
        text: 'For now, you can practice with YouTube videos that have captions.',
        startTime: 5,
        endTime: 10,
        words: ['For', 'now', 'you', 'can', 'practice', 'with', 'YouTube', 'videos', 'that', 'have', 'captions']
      }
    ];

    // Save to cache (even placeholder for now)
    await TranscriptCacheManager.saveTranscriptToCache({
      contentId,
      contentType: file.type.startsWith('video') ? 'video' : 'audio',
      transcript: placeholderTranscript,
      language: 'ja',
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      transcript: placeholderTranscript,
      language: 'ja',
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      },
      message: 'File uploaded successfully. Full transcription coming soon.'
    });

  } catch (error: any) {
    console.error('File upload error:', error);

    return NextResponse.json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'Failed to process uploaded file'
    }, { status: 500 });
  }
}

// Configure Next.js to handle larger file uploads
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for file processing