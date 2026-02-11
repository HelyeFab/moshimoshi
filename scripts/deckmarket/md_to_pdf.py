#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

try:
    import markdown
    from weasyprint import HTML
except Exception as exc:
    sys.stderr.write(
        "Missing dependencies for PDF conversion. Install with: pip install markdown weasyprint\n"
    )
    raise

DEFAULT_CSS = """
@page { size: A4; margin: 20mm; }
body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 12pt; color: #1f2937; }
h1, h2, h3 { color: #111827; }
code { font-family: 'Courier New', monospace; background: #f3f4f6; padding: 2px 4px; border-radius: 3px; }
pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-wrap: break-word; }
blockquote { border-left: 3px solid #e5e7eb; padding-left: 12px; color: #374151; }
"""


def render_pdf(input_path: Path, output_path: Path) -> None:
    text = input_path.read_text(encoding='utf-8')
    html_body = markdown.markdown(text, extensions=['extra', 'tables', 'fenced_code'])
    html = f"""
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>{DEFAULT_CSS}</style>
</head>
<body>
{html_body}
</body>
</html>
"""
    HTML(string=html, base_url=str(input_path.parent)).write_pdf(str(output_path))


def main() -> int:
    parser = argparse.ArgumentParser(description='Convert Markdown to PDF')
    parser.add_argument('--input', required=True, help='Input markdown file path')
    parser.add_argument('--output', required=True, help='Output PDF file path')
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        sys.stderr.write('Input markdown file not found\n')
        return 1

    render_pdf(input_path, output_path)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
