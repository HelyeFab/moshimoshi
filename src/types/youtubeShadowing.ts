export interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
  translation?: string;
}

export interface ShadowingFileInfo {
  name: string;
  size: number;
  type: string;
}

export interface ShadowingVideoMetadata {
  title: string;
  channelTitle: string;
  description: string;
  thumbnails: any;
  duration: string;
  publishedAt: string;
  formattedTranscript?: TranscriptLine[];
  [key: string]: unknown;
}

export interface ShadowingSession {
  videoUrl: string;
  videoTitle?: string;
  audioUrl?: string;
  transcript: TranscriptLine[];
  currentLineIndex: number;
  fileInfo?: ShadowingFileInfo;
  videoMetadata?: ShadowingVideoMetadata;
}
