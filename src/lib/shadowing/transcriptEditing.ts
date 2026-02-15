export type BoundaryTokenSplit = { token: string; remainder: string };

export function joinSegmentTexts(left: string, right: string): string {
  const trimmedLeft = left.trimEnd();
  const trimmedRight = right.trimStart();
  const shouldInsertSpace =
    /[A-Za-z0-9]$/.test(trimmedLeft) && /^[A-Za-z0-9]/.test(trimmedRight);
  return shouldInsertSpace ? `${trimmedLeft} ${trimmedRight}` : `${trimmedLeft}${trimmedRight}`;
}

export function findSplitIndexForText(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length < 4) return null;

  const punctuationMatches = [...trimmed.matchAll(/[。！？!?、]/g)];
  if (punctuationMatches.length > 0) {
    const midpoint = Math.floor(trimmed.length / 2);
    const best = punctuationMatches.reduce((acc, match) => {
      const idx = (match.index ?? 0) + 1;
      return Math.abs(idx - midpoint) < Math.abs(acc - midpoint) ? idx : acc;
    }, (punctuationMatches[0].index ?? 0) + 1);
    if (best >= 2 && best <= trimmed.length - 2) return best;
  }

  const midpoint = Math.floor(trimmed.length / 2);
  if (midpoint >= 2 && midpoint <= trimmed.length - 2) return midpoint;
  return null;
}

export function tokenizeForBoundaryAdjust(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    const parts = Array.from(segmenter.segment(trimmed))
      .map(part => String(part.segment ?? ''))
      .filter(Boolean);
    if (parts.length > 0) return parts;
  } catch {
    // Fallback handled below when Segmenter is unavailable.
  }

  if (/\s/.test(trimmed)) {
    return trimmed.split(/\s+/).filter(Boolean);
  }

  return Array.from(trimmed);
}

export function splitLeadingTokens(
  text: string,
  count: number
): BoundaryTokenSplit | null {
  const tokens = tokenizeForBoundaryAdjust(text);
  if (!tokens.length) return null;
  const safeCount = Math.max(1, Math.min(count, tokens.length - 1));
  const token = tokens.slice(0, safeCount).join('');
  const remainder = text.trim().slice(token.length).trimStart();
  if (!remainder) return null;
  return { token: token.trim(), remainder };
}

export function splitTrailingTokens(
  text: string,
  count: number
): BoundaryTokenSplit | null {
  const tokens = tokenizeForBoundaryAdjust(text);
  if (!tokens.length) return null;
  const safeCount = Math.max(1, Math.min(count, tokens.length - 1));
  const token = tokens.slice(tokens.length - safeCount).join('');
  const trimmed = text.trim();
  const remainder = trimmed.slice(0, Math.max(0, trimmed.length - token.length)).trimEnd();
  if (!remainder) return null;
  return { token: token.trim(), remainder };
}
