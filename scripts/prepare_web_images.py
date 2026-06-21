from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

from PIL import Image


DEFAULT_PATHS = [Path("data") / "cartes", Path("images")]
FAVICON_NAME = "favicon.png"
DEFAULT_QUALITY = 92
DEFAULT_MAX_DIMENSION = 3500


def convert_png_to_webp(
    src: Path,
    force: bool = False,
    quality: int = DEFAULT_QUALITY,
    max_dimension: int = DEFAULT_MAX_DIMENSION,
    lossless: bool = False,
) -> tuple[Path, bool, str]:
    dst = src.with_suffix(".webp")
    if dst.exists() and not force and dst.stat().st_mtime >= src.stat().st_mtime:
        return dst, False, "cached"

    with Image.open(src) as image:
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

        if max_dimension > 0 and max(image.size) > max_dimension:
            image.thumbnail(
                (max_dimension, max_dimension),
                Image.Resampling.LANCZOS,
            )

        lossless_buffer = BytesIO()
        image.save(lossless_buffer, "WEBP", lossless=True, method=6)
        lossless_bytes = lossless_buffer.getvalue()

        codec = "lossless"
        output_bytes = lossless_bytes
        if not lossless:
            lossy_buffer = BytesIO()
            image.save(lossy_buffer, "WEBP", quality=quality, method=6)
            lossy_bytes = lossy_buffer.getvalue()
            if len(lossy_bytes) < len(lossless_bytes):
                codec = f"quality={quality}"
                output_bytes = lossy_bytes

        dst.write_bytes(output_bytes)

    return dst, True, codec


def create_favicon(src: Path, dst: Path, size: int, force: bool = False) -> bool:
    if dst.exists() and not force and dst.stat().st_mtime >= src.stat().st_mtime:
        return False

    with Image.open(src) as image:
        image = image.convert("RGBA")
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        offset = ((size - image.width) // 2, (size - image.height) // 2)
        canvas.paste(image, offset, image)
        canvas.save(dst, "PNG", optimize=True)

    return True


def format_mb(size: int) -> str:
    return f"{size / 1024 / 1024:.2f} MB"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create size-optimized WebP versions of PNG assets for the site."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        default=DEFAULT_PATHS,
        type=Path,
        help="PNG files or directories to convert. Defaults to data/cartes and images.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild WebP files even when they are newer than their PNG source.",
    )
    parser.add_argument(
        "--quality",
        default=DEFAULT_QUALITY,
        type=int,
        choices=range(1, 101),
        metavar="1-100",
        help=f"Lossy WebP quality. Defaults to {DEFAULT_QUALITY}.",
    )
    parser.add_argument(
        "--max-dimension",
        default=DEFAULT_MAX_DIMENSION,
        type=int,
        help=(
            "Maximum width or height in pixels; 0 keeps the original dimensions. "
            f"Defaults to {DEFAULT_MAX_DIMENSION}."
        ),
    )
    parser.add_argument(
        "--lossless",
        action="store_true",
        help="Always use lossless WebP instead of keeping the smaller encoding.",
    )
    parser.add_argument(
        "--no-favicon",
        action="store_true",
        help="Do not create images/favicon.png from images/logo.png.",
    )
    parser.add_argument(
        "--favicon-size",
        default=128,
        type=int,
        help="Favicon canvas size in pixels. Defaults to 128.",
    )
    args = parser.parse_args()

    logo_path = Path("images") / "logo.png"
    favicon_path = Path("images") / FAVICON_NAME
    if not args.no_favicon and logo_path.exists():
        did_create = create_favicon(
            logo_path,
            favicon_path,
            size=args.favicon_size,
            force=args.force,
        )
        status = "created" if did_create else "up-to-date"
        print(f"{status}: {logo_path} -> {favicon_path}")

    sources: list[Path] = []
    for path in args.paths:
        if path.is_dir():
            sources.extend(
                src for src in sorted(path.rglob("*.png")) if src.name != FAVICON_NAME
            )
        elif path.suffix.lower() == ".png":
            sources.append(path)
        else:
            print(f"Skipping non-PNG path: {path}")

    if not sources:
        print("No PNG files found.")
        return 0

    original_total = 0
    web_total = 0
    converted = 0

    for src in sources:
        original_size = src.stat().st_size
        dst, did_convert, codec = convert_png_to_webp(
            src,
            force=args.force,
            quality=args.quality,
            max_dimension=args.max_dimension,
            lossless=args.lossless,
        )
        web_size = dst.stat().st_size
        original_total += original_size
        web_total += web_size
        converted += int(did_convert)

        status = f"converted ({codec})" if did_convert else "up-to-date"
        ratio = 100 * web_size / original_size if original_size else 0
        print(
            f"{status}: {src} -> {dst} "
            f"({format_mb(original_size)} -> {format_mb(web_size)}, {ratio:.0f}%)"
        )

    print(
        f"Done: {converted}/{len(sources)} converted. "
        f"Total {format_mb(original_total)} -> {format_mb(web_total)}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
