import { NextResponse } from "next/server";
import { extractVideoId } from "@/lib/video";
import { transcriptCache } from "@/lib/transcript/cache";
import { queueTranscriptTranslations, TranscriptSegment as TranslationSegment } from "@/lib/ai/utils/transcriptTranslationGenerator";

type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  translation?: string;
};

type TranscriptPayload = {
  segments: TranscriptSegment[];
  language?: string;
  source: "youtube-timedtext" | "transcript-service" | "firebase-cache";
  hasTranslations?: boolean;
  translationStatus?: "none" | "queued" | "generating" | "complete" | "failed";
};

type TimedTextEvent = {
  tStartMs?: number;
  dDurationMs?: number;
  d?: number;
  segs?: { utf8: string }[];
};

type TranscriptServiceSegment = {
  start?: number;
  end?: number;
  duration?: number;
  text?: string;
};

const FALLBACK_SERVICE_URL =
  process.env.TRANSCRIPT_SERVICE_URL ||
  "http://localhost:5000/get-japanese-transcript";

// Enable auto-translation of new transcripts (can be disabled via env var)
const AUTO_TRANSLATE_ENABLED = process.env.AUTO_TRANSLATE_TRANSCRIPTS !== "false";

/**
 * Queue background translation generation for new transcripts
 * Fire-and-forget - doesn't block the response
 */
function triggerBackgroundTranslation(
  contentId: string,
  segments: TranscriptSegment[],
): void {
  if (!AUTO_TRANSLATE_ENABLED) {
    console.log(`[TRANSCRIPT-API] Auto-translate disabled, skipping`);
    return;
  }

  // Convert to translation format and queue
  const translationSegments: TranslationSegment[] = segments.map((seg, i) => ({
    id: String(i + 1),
    text: seg.text,
    startTime: seg.start,
    endTime: seg.end,
  }));

  // Fire and forget - don't await
  queueTranscriptTranslations(contentId, translationSegments, {
    mode: "full",
    userLevel: "N4",
  })
    .then((result) => {
      console.log(`[TRANSCRIPT-API] Translation queued: ${result.message}`);
    })
    .catch((err) => {
      console.error(`[TRANSCRIPT-API] Translation queue failed:`, err);
    });
}

async function fetchYouTubeTimedText(
  videoId: string,
  language: string,
): Promise<TranscriptPayload | null> {
  const url = new URL("https://www.youtube.com/api/timedtext");
  url.searchParams.set("v", videoId);
  url.searchParams.set("lang", language);
  url.searchParams.set("fmt", "json3");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept-Language": language,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!payload?.events?.length) {
    return null;
  }

  const segments: TranscriptSegment[] = (payload.events as TimedTextEvent[])
    .map((event) => {
      const startMs = event.tStartMs ?? 0;
      const durationMs = event.dDurationMs ?? event.d ?? 0;
      const text =
        Array.isArray(event.segs) && event.segs.length
          ? event.segs.map((seg) => seg.utf8).join("").trim()
          : "";

      const start = startMs / 1000;
      const end = durationMs ? start + durationMs / 1000 : start + 0.2;

      if (!text) return null;

      return { start, end, text };
    })
    .filter(Boolean) as TranscriptSegment[];

  if (!segments.length) {
    return null;
  }

  return {
    segments,
    language,
    source: "youtube-timedtext",
  };
}

async function fetchTranscriptService(
  videoId: string,
  language: string,
): Promise<TranscriptPayload | null> {
  const url = new URL(FALLBACK_SERVICE_URL);

  url.searchParams.set("videoId", videoId);

  if (!url.pathname.includes("get-japanese") && language) {
    url.searchParams.set("lang", language);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!payload?.segments?.length) {
    return null;
  }

  const segments: TranscriptSegment[] = (
    payload.segments as TranscriptServiceSegment[]
  )
    .map((segment) => {
      const start = Number(segment.start ?? 0);
      const end =
        Number(segment.end ?? 0) ||
        (segment.duration ? start + Number(segment.duration) : start + 0.2);
      const text = String(segment.text ?? "").trim();

      if (!text) return null;

      return { start, end, text };
    })
    .filter(Boolean) as TranscriptSegment[];

  if (!segments.length) {
    return null;
  }

  return {
    segments,
    language: payload.language || language,
    source: "transcript-service",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawVideoId = searchParams.get("videoId") || "";
  const language = searchParams.get("lang") || "ja";
  const videoId = extractVideoId(rawVideoId);

  if (!videoId) {
    return NextResponse.json(
      { error: "Invalid YouTube URL or ID" },
      { status: 400 },
    );
  }

  const contentId = `youtube_${videoId}`;

  try {
    // Step 1: Check Firebase cache first
    console.log(`[TRANSCRIPT-API] Checking cache for ${videoId}`);
    const cached = await transcriptCache.get(contentId);

    if (cached && cached.transcript && cached.transcript.length > 0) {
      console.log(`[TRANSCRIPT-API] Cache hit: ${cached.transcript.length} segments`);

      // Transform cached format to API format (including translations if available)
      const segments: TranscriptSegment[] = cached.transcript.map((line) => ({
        start: line.startTime,
        end: line.endTime,
        text: line.text,
        translation: line.translation,
      }));

      // Check translation status
      const translatedCount = segments.filter((s) => s.translation).length;
      const hasTranslations = translatedCount >= segments.length * 0.8;
      const metadata = cached.metadata as { translationStatus?: string } | undefined;
      const translationStatus = metadata?.translationStatus as TranscriptPayload["translationStatus"] ||
        (hasTranslations ? "complete" : translatedCount > 0 ? "generating" : "none");

      return NextResponse.json<TranscriptPayload>({
        segments,
        language: cached.language || language,
        source: "firebase-cache",
        hasTranslations,
        translationStatus,
      });
    }

    console.log(`[TRANSCRIPT-API] Cache miss - fetching from source`);

    // Step 2: Try YouTube timedtext API
    const directTranscript = await fetchYouTubeTimedText(videoId, language);

    if (directTranscript) {
      // Save to cache (async, don't block response)
      transcriptCache.set({
        contentId,
        contentType: "youtube",
        transcript: directTranscript.segments.map((seg, i) => ({
          id: String(i + 1),
          text: seg.text,
          startTime: seg.start,
          endTime: seg.end,
        })),
        language: directTranscript.language || language,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        metadata: { youtubeVideoId: videoId },
      }).catch((err) => console.error("[TRANSCRIPT-API] Cache save failed:", err));

      // Queue background translation generation (fire and forget)
      triggerBackgroundTranslation(contentId, directTranscript.segments);

      return NextResponse.json({
        ...directTranscript,
        hasTranslations: false,
        translationStatus: "queued" as const,
      });
    }

    // Step 3: Try fallback transcript service
    const fallbackTranscript = await fetchTranscriptService(videoId, language);

    if (fallbackTranscript) {
      // Save to cache (async, don't block response)
      transcriptCache.set({
        contentId,
        contentType: "youtube",
        transcript: fallbackTranscript.segments.map((seg, i) => ({
          id: String(i + 1),
          text: seg.text,
          startTime: seg.start,
          endTime: seg.end,
        })),
        language: fallbackTranscript.language || language,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        metadata: { youtubeVideoId: videoId },
      }).catch((err) => console.error("[TRANSCRIPT-API] Cache save failed:", err));

      // Queue background translation generation (fire and forget)
      triggerBackgroundTranslation(contentId, fallbackTranscript.segments);

      return NextResponse.json({
        ...fallbackTranscript,
        hasTranslations: false,
        translationStatus: "queued" as const,
      });
    }

    return NextResponse.json(
      { error: "No transcript available for this video" },
      { status: 404 },
    );
  } catch (error) {
    console.error("Transcript fetch failed", error);
    return NextResponse.json(
      { error: "Failed to fetch transcript" },
      { status: 500 },
    );
  }
}
