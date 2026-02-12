import { NextRequest, NextResponse } from 'next/server';
import { transcriptCache } from '@/lib/transcript/cache';
import { extractVideoId } from '@/lib/video';

type SegmentPayload = {
  start: number;
  end: number;
  text: string;
};

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawVideoId = body?.videoId;
    const translation = body?.translation;
    const segment = body?.segment as SegmentPayload | undefined;

    const videoId = extractVideoId(rawVideoId || '');
    if (!videoId || !segment?.text || typeof segment.start !== 'number' || typeof segment.end !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (!translation || typeof translation !== 'string') {
      return NextResponse.json({ error: 'Missing translation' }, { status: 400 });
    }

    const contentId = `youtube_${videoId}`;
    const cached = await transcriptCache.get(contentId);
    if (!cached || !cached.transcript || cached.transcript.length === 0) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    const targetText = normalizeText(segment.text);
    const updatedTranscript = cached.transcript.map(line => ({ ...line }));

    const index = updatedTranscript.findIndex(line => {
      const textMatches = normalizeText(line.text) === targetText;
      const startMatches = Math.abs(line.startTime - segment.start) < 0.05;
      const endMatches = Math.abs(line.endTime - segment.end) < 0.05;
      return textMatches && startMatches && endMatches;
    });

    if (index === -1) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    updatedTranscript[index].translation = translation;

    const saved = await transcriptCache.updateTranscriptWithMetadata({
      contentId,
      transcript: updatedTranscript,
      metadata: {
        'metadata.translationUpdatedAt': new Date(),
      },
    });

    if (!saved) {
      return NextResponse.json({ error: 'Failed to persist translation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to persist translation' }, { status: 500 });
  }
}
