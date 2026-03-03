#!/usr/bin/env python3

import argparse
import csv
import hashlib
import os
import re
import sys

try:
    import genanki
except ImportError as exc:
    print('genanki is required. Install with: pip install genanki', file=sys.stderr)
    raise


def stable_id(value: str) -> int:
    digest = hashlib.sha256(value.encode('utf-8')).digest()
    # SQLite INTEGER is signed 64-bit; keep IDs within 0..(2^63 - 1)
    return int.from_bytes(digest[:8], 'big') & 0x7FFFFFFFFFFFFFFF


def normalize_rows(rows):
    if not rows:
        return []

    header = [cell.strip().lower() for cell in rows[0]]
    has_header = 'front' in header and 'back' in header

    start_index = 1 if has_header else 0
    normalized = []

    for row in rows[start_index:]:
        if not row:
            continue
        front = row[0].strip() if len(row) > 0 else ''
        back = row[1].strip() if len(row) > 1 else ''
        notes = row[2].strip() if len(row) > 2 else ''

        if not front or not back:
            continue

        normalized.append((front, back, notes))

    return normalized


def read_csv(path: str):
    with open(path, 'r', encoding='utf-8-sig', newline='') as handle:
        reader = csv.reader(handle)
        rows = [row for row in reader]
    return normalize_rows(rows)


def parse_note_index(note_id: str):
    if not note_id:
        return None
    match = re.search(r'jp500_(\d{4})', note_id)
    if not match:
        return None
    try:
        value = int(match.group(1))
        return value if value > 0 else None
    except ValueError:
        return None


def strip_html(value: str) -> str:
    return re.sub(r'<[^>]+>', '', value or '').strip()


def build_deck(deck_name: str, deck_id: str, cards, audio_root: str | None = None):
    model_id = stable_id(f'{deck_id}-model')
    deck_id_int = stable_id(deck_id)

    model = genanki.Model(
        model_id,
        'DeckMarket Basic',
        fields=[
            {'name': 'Front'},
            {'name': 'Back'},
        ],
        templates=[
            {
                'name': 'Card 1',
                'qfmt': '{{Front}}',
                'afmt': '{{FrontSide}}<hr id="answer">{{Back}}',
            }
        ],
        css="""
.card {
  font-family: arial;
  font-size: 20px;
  text-align: left;
  color: black;
  background-color: white;
}
""",
    )

    deck = genanki.Deck(deck_id_int, deck_name)
    media_files: list[str] = []

    def to_html(value: str) -> str:
        # Preserve multiline CSV fields in Anki HTML rendering.
        return value.replace('\r\n', '\n').replace('\r', '\n').replace('\n', '<br>')

    def audio_path(kind: str, index: int) -> str:
        if not audio_root:
            return ''
        filename = f'{kind}_{index:03}.wav'
        return os.path.join(audio_root, f'{kind}s', filename)

    for front, back, notes in cards:
        front_value = to_html(front)
        back_value = to_html(back)
        back_lines = [line.strip() for line in back.replace('\r', '\n').split('\n') if line.strip()]
        is_sentence_card = len(back_lines) >= 1 and strip_html(back_lines[0]) == strip_html(front)

        card_index = parse_note_index(notes)
        if card_index:
            word_audio = audio_path('word', card_index)
            sentence_audio = audio_path('sentence', card_index)
            front_audio = sentence_audio if is_sentence_card else word_audio
            back_audio = sentence_audio

            if front_audio and os.path.exists(front_audio):
                front_value = f'[sound:{os.path.basename(front_audio)}]<br>{front_value}'
                media_files.append(front_audio)
            if back_audio and os.path.exists(back_audio):
                back_value = f'{back_value}<br>[sound:{os.path.basename(back_audio)}]'
                media_files.append(back_audio)

        if notes:
            back_value = f'{back_value}<br>{to_html(notes)}'
        note = genanki.Note(model=model, fields=[front_value, back_value])
        deck.add_note(note)

    return deck, sorted(set(media_files))


def main():
    parser = argparse.ArgumentParser(description='Convert CSV to Anki .apkg')
    parser.add_argument('--input', required=True, help='Path to CSV input')
    parser.add_argument('--output', required=True, help='Path to output .apkg')
    parser.add_argument('--deck-name', required=True, help='Deck name')
    parser.add_argument('--deck-id', required=True, help='Deck ID for stable identifiers')
    parser.add_argument(
        '--audio-root',
        default=None,
        help='Root audio folder containing words/ and sentences/ subfolders (optional)',
    )

    args = parser.parse_args()

    cards = read_csv(args.input)
    if not cards:
        print('No valid cards found in CSV', file=sys.stderr)
        sys.exit(1)

    deck, media_files = build_deck(args.deck_name, args.deck_id, cards, args.audio_root)
    package = genanki.Package(deck)
    if media_files:
        package.media_files = media_files
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    package.write_to_file(args.output)


if __name__ == '__main__':
    main()
