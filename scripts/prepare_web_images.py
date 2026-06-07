from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


DEFAULT_PATHS = [Path("data") / "cartes", Path("images")]
FAVICON_NAME = "favicon.png"


def convert_png_to_webp(src: Path, force: bool = False) -> tuple[Path, bool]:
    dst = src.with_suffix(".webp")
    if dst.exists() and not force and dst.stat().st_mtime >= src.stat().st_mtime:
        return dst, False

    with Image.open(src) as image:
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        image.save(dst, "WEBP", lossless=True, method=6)

    return dst, True


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
        description="Create lossless WebP versions of PNG assets for the static site."
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
        dst, did_convert = convert_png_to_webp(src, force=args.force)
        web_size = dst.stat().st_size
        original_total += original_size
        web_total += web_size
        converted += int(did_convert)

        status = "converted" if did_convert else "up-to-date"
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
