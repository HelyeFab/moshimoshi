export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  const directId = /^[a-zA-Z0-9_-]{11}$/;

  if (directId.test(trimmed)) {
    return trimmed;
  }

  // Support music.youtube.com, youtu.be, shorts, embed, mobile, and extra query params
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:music\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?(?:m\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:music\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:music\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function clampRepeatCount(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(10, Math.max(1, Math.floor(value)));
}
