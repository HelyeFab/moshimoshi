import { NextRequest, NextResponse } from 'next/server';
import { transcriptCache } from '@/lib/transcript/cache';
import { extractVideoId } from '@/lib/video';

type OverrideSegment = {
  text: string;
  start: number;
  end: number;
  translation?: string;
};

const MIN_SEGMENT_DURATION_SECONDS = 0.2;
const SEGMENT_EPSILON_SECONDS = 0.02;
const BACKUP_VERSION = 'v1';

function buildContentIds(videoId: string) {
  return {
    contentId: `youtube_${videoId}`,
    backupContentId: `youtube_${videoId}__override_backup_${BACKUP_VERSION}`,
  };
}

function normalizeSegments(segments: OverrideSegment[]): OverrideSegment[] {
  const ordered = segments
    .map(segment => ({
      ...segment,
      text: String(segment.text || '').trim(),
      start: Number(segment.start),
      end: Number(segment.end),
    }))
    .filter(
      segment =>
        segment.text.length > 0 &&
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end)
    )
    .sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return a.end - b.end;
    });

  return ordered.map((segment, index) => {
    const prev = ordered[index - 1];
    const next = ordered[index + 1];
    let start = segment.start;
    let end = segment.end;

    if (prev && start < prev.end) {
      start = prev.end + SEGMENT_EPSILON_SECONDS;
    }

    if (next && end > next.start) {
      end = next.start - SEGMENT_EPSILON_SECONDS;
    }

    if (end <= start) {
      end = start + MIN_SEGMENT_DURATION_SECONDS;
    }

    return {
      text: segment.text,
      start,
      end,
      ...(segment.translation ? { translation: segment.translation } : {}),
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoId = extractVideoId(body?.videoId || '');
    const incomingSegments = body?.segments as OverrideSegment[] | undefined;

    if (!videoId || !Array.isArray(incomingSegments) || incomingSegments.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const normalized = normalizeSegments(incomingSegments);
    if (!normalized.length) {
      return NextResponse.json({ error: 'No valid segments to save' }, { status: 400 });
    }

    const { contentId, backupContentId } = buildContentIds(videoId);
    const cached = await transcriptCache.get(contentId);
    if (!cached) {
      return NextResponse.json({ error: 'Transcript cache entry not found' }, { status: 404 });
    }

    const backup = await transcriptCache.get(backupContentId);
    if (!backup || !Array.isArray(backup.transcript) || backup.transcript.length === 0) {
      await transcriptCache.set({
        contentId: backupContentId,
        contentType: 'youtube',
        transcript: cached.transcript.map((line, index) => ({
          id: line.id || String(index + 1),
          text: line.text,
          startTime: line.startTime,
          endTime: line.endTime,
          ...(line.translation ? { translation: line.translation } : {}),
        })),
        ...(Array.isArray(cached.formattedTranscript)
          ? { formattedTranscript: cached.formattedTranscript.map((line, index) => ({
              id: line.id || String(index + 1),
              text: line.text,
              startTime: line.startTime,
              endTime: line.endTime,
              ...(line.translation ? { translation: line.translation } : {}),
            })) }
          : {}),
        language: cached.language || 'ja',
        videoUrl: cached.videoUrl,
        videoTitle: cached.videoTitle,
        metadata: {
          sourceContentId: contentId,
          backupType: 'pre_user_override',
          createdAt: new Date(),
        },
      });
    }

    const saved = await transcriptCache.updateTranscriptWithMetadata({
      contentId,
      transcript: normalized.map((segment, index) => ({
        id: String(index + 1),
        text: segment.text,
        startTime: segment.start,
        endTime: segment.end,
        ...(segment.translation ? { translation: segment.translation } : {}),
      })),
      metadata: {
        'metadata.userTranscriptOverride.enabled': true,
        'metadata.userTranscriptOverride.updatedAt': new Date(),
        'metadata.userTranscriptOverride.segmentCount': normalized.length,
        'metadata.userTranscriptOverride.backupContentId': backupContentId,
      },
    });

    if (!saved) {
      return NextResponse.json({ error: 'Failed to persist transcript override' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      segmentCount: normalized.length,
    });
  } catch (error) {
    console.error('[TranscriptOverride] Failed to persist transcript override:', error);
    return NextResponse.json({ error: 'Failed to persist transcript override' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const videoId = extractVideoId(body?.videoId || '');
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { contentId, backupContentId } = buildContentIds(videoId);
    const backup = await transcriptCache.get(backupContentId);
    if (!backup || !Array.isArray(backup.transcript) || backup.transcript.length === 0) {
      return NextResponse.json({ error: 'Original transcript backup not found' }, { status: 404 });
    }

    const restored = await transcriptCache.updateTranscriptWithMetadata({
      contentId,
      transcript: backup.transcript.map((line, index) => ({
        id: line.id || String(index + 1),
        text: line.text,
        startTime: line.startTime,
        endTime: line.endTime,
        ...(line.translation ? { translation: line.translation } : {}),
      })),
      ...(Array.isArray(backup.formattedTranscript)
        ? {
            formattedTranscript: backup.formattedTranscript.map((line, index) => ({
              id: line.id || String(index + 1),
              text: line.text,
              startTime: line.startTime,
              endTime: line.endTime,
              ...(line.translation ? { translation: line.translation } : {}),
            })),
          }
        : {}),
      metadata: {
        'metadata.userTranscriptOverride.enabled': false,
        'metadata.userTranscriptOverride.resetAt': new Date(),
        'metadata.userTranscriptOverride.segmentCount': backup.transcript.length,
        'metadata.userTranscriptOverride.backupContentId': backupContentId,
      },
    });

    if (!restored) {
      return NextResponse.json({ error: 'Failed to restore original transcript' }, { status: 500 });
    }

    return NextResponse.json({ success: true, segmentCount: backup.transcript.length });
  } catch (error) {
    console.error('[TranscriptOverride] Failed to reset transcript override:', error);
    return NextResponse.json({ error: 'Failed to reset transcript override' }, { status: 500 });
  }
}
