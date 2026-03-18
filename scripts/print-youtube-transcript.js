#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const storage = admin.storage();

const videoId = process.argv[2];
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : null;

if (!videoId) {
  console.error('Usage: node scripts/print-youtube-transcript.js <youtubeVideoId> [--limit=20]');
  process.exit(1);
}

function formatTime(seconds) {
  const totalMs = Math.round((seconds || 0) * 1000);
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function normalizeSegments(items) {
  if (!Array.isArray(items)) return [];
  return items.map((seg, index) => ({
    index: index + 1,
    text: seg.text || '',
    start:
      typeof seg.start === 'number'
        ? seg.start
        : typeof seg.startTime === 'number'
          ? seg.startTime
          : 0,
    end:
      typeof seg.end === 'number'
        ? seg.end
        : typeof seg.endTime === 'number'
          ? seg.endTime
          : 0,
    translation: seg.translation,
  }));
}

async function loadStoredTranscript(storagePath) {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Storage file not found: ${storagePath}`);
  }
  const [buffer] = await file.download();
  const parsed = JSON.parse(buffer.toString('utf8'));
  const transcript = Array.isArray(parsed.transcript) ? parsed.transcript : [];
  return transcript;
}

async function main() {
  const contentId = `youtube_${videoId}`;
  const doc = await db.collection('transcriptCache').doc(contentId).get();

  if (!doc.exists) {
    console.error(`Transcript not found for ${contentId}`);
    process.exit(1);
  }

  const data = doc.data() || {};
  let segments = Array.isArray(data.transcript) ? data.transcript : [];

  if ((!segments || segments.length === 0) && data.transcriptStoragePath) {
    segments = await loadStoredTranscript(data.transcriptStoragePath);
  }

  const normalized = normalizeSegments(segments);
  const shown = limit && Number.isFinite(limit) ? normalized.slice(0, limit) : normalized;

  console.log(`Video ID: ${videoId}`);
  console.log(`Content ID: ${contentId}`);
  console.log(`Title: ${data.title || data.videoTitle || 'Unknown'}`);
  console.log(`Source transcript segments: ${normalized.length}`);
  console.log(`Storage path: ${data.transcriptStoragePath || 'n/a'}`);
  console.log('');

  for (const seg of shown) {
    console.log(
      `[${String(seg.index).padStart(3, '0')}] ${formatTime(seg.start)} -> ${formatTime(seg.end)} | ${seg.text}`
    );
    if (seg.translation) {
      console.log(`      translation: ${seg.translation}`);
    }
  }

  if (shown.length < normalized.length) {
    console.log('');
    console.log(`Showing ${shown.length} of ${normalized.length} segments`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
