#!/usr/bin/env python3

import argparse
import csv
import hashlib
import os
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


def build_deck(deck_name: str, deck_id: str, cards):
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

    for front, back, notes in cards:
        back_value = back
        if notes:
            back_value = f'{back_value}<br>{notes}'
        note = genanki.Note(model=model, fields=[front, back_value])
        deck.add_note(note)

    return deck


def main():
    parser = argparse.ArgumentParser(description='Convert CSV to Anki .apkg')
    parser.add_argument('--input', required=True, help='Path to CSV input')
    parser.add_argument('--output', required=True, help='Path to output .apkg')
    parser.add_argument('--deck-name', required=True, help='Deck name')
    parser.add_argument('--deck-id', required=True, help='Deck ID for stable identifiers')

    args = parser.parse_args()

    cards = read_csv(args.input)
    if not cards:
        print('No valid cards found in CSV', file=sys.stderr)
        sys.exit(1)

    deck = build_deck(args.deck_name, args.deck_id, cards)
    package = genanki.Package(deck)
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    package.write_to_file(args.output)


if __name__ == '__main__':
    main()
