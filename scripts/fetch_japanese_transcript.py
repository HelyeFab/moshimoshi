#!/usr/bin/env python3
"""
Japanese YouTube Transcript Fetcher
Uses the python youtube-transcript-api package for robust Japanese language support
Based on Context7 documentation for jdepoix/youtube-transcript-api
"""

import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound

def fetch_japanese_transcript(video_id):
    """
    Fetch Japanese transcript for a YouTube video
    Prioritizes Japanese over Japanese auto-generated, then falls back to other languages
    """
    try:
        ytt_api = YouTubeTranscriptApi()
        
        # First, list all available transcripts to see what's available
        transcript_list = ytt_api.list(video_id)
        
        available_transcripts = []
        japanese_transcripts = []
        
        # Collect all available transcripts and identify Japanese ones
        for transcript in transcript_list:
            transcript_info = {
                'language': transcript.language,
                'language_code': transcript.language_code,
                'is_generated': transcript.is_generated,
                'is_translatable': transcript.is_translatable
            }
            available_transcripts.append(transcript_info)
            
            # Check for Japanese transcripts (language code 'ja' or Japanese in name)
            if (transcript.language_code == 'ja' or 
                'japanese' in transcript.language.lower() or 
                '日本語' in transcript.language):
                japanese_transcripts.append({
                    'transcript': transcript,
                    'info': transcript_info
                })
        
        print(f"Available transcripts for {video_id}:", file=sys.stderr)
        for t in available_transcripts:
            print(f"  - {t['language']} ({t['language_code']}) - Generated: {t['is_generated']}", file=sys.stderr)
        
        print(f"Japanese transcripts found: {len(japanese_transcripts)}", file=sys.stderr)
        
        selected_transcript = None
        
        if japanese_transcripts:
            # Prefer manual Japanese over auto-generated Japanese
            manual_japanese = [jt for jt in japanese_transcripts if not jt['info']['is_generated']]
            if manual_japanese:
                selected_transcript = manual_japanese[0]['transcript']
                print(f"Selected manual Japanese transcript: {manual_japanese[0]['info']['language']}", file=sys.stderr)
            else:
                selected_transcript = japanese_transcripts[0]['transcript']
                print(f"Selected auto-generated Japanese transcript: {japanese_transcripts[0]['info']['language']}", file=sys.stderr)
        else:
            # No Japanese transcripts found - this should trigger an error for Japanese-only requirement
            print("ERROR: No Japanese transcripts available for this video", file=sys.stderr)
            return {
                'available': False,
                'videoId': video_id,
                'message': 'No Japanese transcripts available for this video',
                'availableLanguages': [t['language'] + ' (' + t['language_code'] + ')' for t in available_transcripts],
                'source': 'python-transcript-api'
            }
        
        # Fetch the actual transcript data
        fetched_transcript = selected_transcript.fetch()
        
        # Transform to our expected format
        segments = []
        for snippet in fetched_transcript:
            # According to Context7 docs, snippet has .start, .duration, .text attributes
            start = float(snippet.start)
            duration = float(snippet.duration)
            end = start + duration
            text = snippet.text.strip()
            
            # Skip empty or music/sound effect annotations
            if text and not (text.startswith('[') and text.endswith(']')):
                segments.append({
                    'start': start,
                    'duration': duration,
                    'end': end,
                    'text': text
                })
        
        return {
            'available': True,
            'videoId': video_id,
            'title': f'Video {video_id}',  # We don't get title from this API
            'language': selected_transcript.language,
            'languageCode': selected_transcript.language_code,
            'isJapanese': True,
            'isGenerated': selected_transcript.is_generated,
            'availableLanguages': [jt['info']['language'] + (' (auto)' if jt['info']['is_generated'] else ' (manual)') 
                                 for jt in japanese_transcripts],
            'segments': segments,
            'totalSegments': len(segments),
            'totalDuration': segments[-1]['end'] if segments else 0,
            'source': 'python-transcript-api'
        }
        
    except TranscriptsDisabled:
        return {
            'available': False,
            'videoId': video_id,
            'message': 'Transcripts are disabled for this video',
            'source': 'python-transcript-api'
        }
    except NoTranscriptFound as e:
        return {
            'available': False,
            'videoId': video_id,
            'message': f'No transcript found: {str(e)}',
            'source': 'python-transcript-api'
        }
    except Exception as e:
        return {
            'available': False,
            'videoId': video_id,
            'message': f'Error fetching transcript: {str(e)}',
            'source': 'python-transcript-api'
        }

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 fetch_japanese_transcript.py <video_id>", file=sys.stderr)
        sys.exit(1)
    
    video_id = sys.argv[1]
    result = fetch_japanese_transcript(video_id)
    
    # Output JSON to stdout for the Node.js API to consume
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()