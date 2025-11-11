import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

interface TranscriptSegment {
  start: number;
  end: number;
  duration: number;
  text: string;
}

interface TranscriptResponse {
  available: boolean;
  videoId: string;
  title?: string;
  segments?: TranscriptSegment[];
  language?: string;
  availableLanguages?: string[];
  forcedJapanese?: boolean;
  languageNote?: string;
  totalSegments?: number;
  totalDuration?: number;
  message?: string;
  error?: string;
}

let youtubeClient: Innertube | null = null;

async function getClient(): Promise<Innertube> {
  if (!youtubeClient) {
    youtubeClient = await Innertube.create();
  }
  return youtubeClient;
}

function isJapaneseTitle(title: string | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return (lower.includes('japanese') || lower.includes('日本語')) &&
    !lower.includes('english') && !lower.includes('英語');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  let videoId = '';

  try {
    const resolved = await params;
    videoId = resolved.videoId;

    if (!videoId) {
      return NextResponse.json<TranscriptResponse>(
        { available: false, videoId: '', error: 'Video ID is required' },
        { status: 400 }
      );
    }

    const client = await getClient();
    const videoInfo = await client.getInfo(videoId);
    const transcriptInfo = await videoInfo.getTranscript();

    const languageMenu = transcriptInfo?.transcript?.content?.footer?.language_menu;
    const availableLanguages = languageMenu?.sub_menu_items || [];

    const japaneseOptions = availableLanguages.filter((lang: any) =>
      isJapaneseTitle(lang.title)
    );

    if (japaneseOptions.length === 0) {
      return NextResponse.json<TranscriptResponse>({
        available: false,
        videoId,
        title: videoInfo.basic_info?.title || 'Unknown title',
        message: 'Japanese transcript not available for this video.',
        availableLanguages: availableLanguages.map((lang: any) => lang.title)
      });
    }

    let transcriptPayload = transcriptInfo;
    let selectedLanguage = availableLanguages.find((lang: any) => lang.selected);
    let forcedJapanese = false;

    if (!isJapaneseTitle(selectedLanguage?.title) && japaneseOptions[0]?.continuation) {
      try {
        const session = (client as any).session;
        const payload = {
          context: session?.context,
          continuation: japaneseOptions[0].continuation
        };

        let response: any = null;

        if (client?.actions?.execute) {
          response = await client.actions.execute('/youtubei/v1/get_transcript', payload);
        } else if (session?.actions?.execute) {
          response = await session.actions.execute('/youtubei/v1/get_transcript', payload);
        } else if (session?.http?.fetch) {
          response = await session.http.fetch('/youtubei/v1/get_transcript', payload);
        }

        const transcriptContent =
          response?.actions?.[0]?.updateEngagementPanelAction?.content?.transcript ??
          response?.data?.actions?.[0]?.updateEngagementPanelAction?.content?.transcript ??
          response?.transcript;

        if (transcriptContent) {
          transcriptPayload = { transcript: transcriptContent };
          selectedLanguage = japaneseOptions[0];
          forcedJapanese = true;
        }
      } catch {
        // Ignore forcing errors; fall back to default transcript.
      }
    } else if (isJapaneseTitle(selectedLanguage?.title)) {
      forcedJapanese = true;
    }

    const rawSegments = transcriptPayload?.transcript?.content?.body?.initial_segments;

    if (!rawSegments || rawSegments.length === 0) {
      return NextResponse.json<TranscriptResponse>({
        available: false,
        videoId,
        title: videoInfo.basic_info?.title || 'Unknown title',
        message: 'Transcript not available for this video.',
        availableLanguages: japaneseOptions.map((lang: any) => lang.title)
      });
    }

    const segments: TranscriptSegment[] = rawSegments
      .map((segment: any) => {
        const startMs = Number(segment.start_ms ?? 0);
        const endMs = Number(segment.end_ms ?? startMs);
        const start = startMs / 1000;
        const end = endMs / 1000;
        const text =
          segment.snippet?.text ||
          segment.snippet?.runs?.[0]?.text ||
          '';

        return {
          start,
          end,
          duration: end - start,
          text: text.trim()
        };
      })
      .filter((segment: TranscriptSegment) => segment.text.length > 0 && !/^[\[].*[\]]$/.test(segment.text));

    const languageTitle = selectedLanguage?.title || japaneseOptions[0]?.title || 'Unknown';
    const isJapanese = forcedJapanese || isJapaneseTitle(languageTitle);

    const languageNote = !isJapanese
      ? `Currently showing ${languageTitle}. Japanese options: ${japaneseOptions.map((lang: any) => lang.title).join(', ')}`
      : undefined;

    return NextResponse.json<TranscriptResponse>({
      available: true,
      videoId,
      title: videoInfo.basic_info?.title || 'Unknown title',
      language: languageTitle,
      forcedJapanese,
      languageNote,
      segments,
      availableLanguages: japaneseOptions.map((lang: any) => lang.title),
      totalSegments: segments.length,
      totalDuration: segments.length > 0 ? segments[segments.length - 1].end : 0
    });
  } catch (error) {
    return NextResponse.json<TranscriptResponse>(
      {
        available: false,
        videoId,
        error: 'Failed to fetch transcript',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
