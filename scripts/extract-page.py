#!/usr/bin/env python3
"""
VibeReading — Extract a PDF page as an image for diagram reference.

Usage:
  python3 scripts/extract-page.py <pdf-path> <page-number> [--dpi 200] [--output /tmp/diagram.png]

Extracts the specified page (0-indexed) from the PDF and saves it as a PNG image.
The agent can then 'read' this image to see book diagrams and reference them during teaching.

Requires: pymupdf (pip3 install pymupdf)
"""

import sys
import os

try:
    import pymupdf
except ImportError:
    print("ERROR: pymupdf not installed. Run: pip3 install pymupdf", file=sys.stderr)
    sys.exit(1)


def main():
    args = sys.argv[1:]

    if len(args) < 2 or args[0] in ("-h", "--help"):
        print(__doc__.strip())
        sys.exit(0 if args[0:1] in (["-h"], ["--help"]) else 1)

    pdf_path = args[0]
    page_num = int(args[1])
    dpi = 200
    output_path = f"/tmp/vibereading-page-{page_num}.png"

    for i, arg in enumerate(args[2:], start=2):
        if arg == "--dpi" and i + 1 < len(args) + 2:
            dpi = int(args[i + 1])
        if arg == "--output" and i + 1 < len(args) + 2:
            output_path = args[i + 1]

    if not os.path.exists(pdf_path):
        print(f"ERROR: PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    try:
        doc = pymupdf.open(pdf_path)
    except Exception as e:
        print(f"ERROR: Could not open PDF: {e}", file=sys.stderr)
        sys.exit(1)

    if page_num < 0 or page_num >= len(doc):
        print(f"ERROR: Page {page_num} out of range. PDF has {len(doc)} pages (0-{len(doc)-1}).", file=sys.stderr)
        doc.close()
        sys.exit(1)

    page = doc[page_num]
    pix = page.get_pixmap(dpi=dpi)
    pix.save(output_path)
    doc.close()

    print(f"OK {output_path} {pix.width}x{pix.height}")


if __name__ == "__main__":
    main()
