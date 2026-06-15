from __future__ import annotations

from pathlib import Path

from PIL import Image


PREVIEWS = [
    {
        "source": Path("data")
        / "cartes"
        / "municipales 2026"
        / "temps trajet noum\u00e9a bureaux complets.webp",
        "output": Path("images") / "previews" / "regroupement-bureaux-vote-noumea.jpg",
    },
    {
        "source": Path("data")
        / "cartes"
        / "capital socio-economique"
        / "capital_acp_lisse_nc.webp",
        "output": Path("images") / "previews" / "capital-socio-economique-nc.jpg",
    },
    {
        "source": Path("data")
        / "cartes"
        / "municipales 2026"
        / "municipales_2026_moins_2020_t1_noumea_ecart_participation.webp",
        "output": Path("images")
        / "previews"
        / "ecart-participation-noumea-2020-2026.jpg",
    },
    {
        "source": Path("docs")
        / "posts"
        / "provinciales-2026-qui-part-qui-reste"
        / "index_files"
        / "figure-html"
        / "flux-sud-1.png",
        "output": Path("images") / "previews" / "provinciales-2026-flux-sud.jpg",
    },
]


def fit_on_canvas(src: Path, dst: Path, width: int = 1200, height: int = 630) -> bool:
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return False

    dst.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(src) as image:
        image = image.convert("RGB")
        image.thumbnail((width, height), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (width, height), "white")
        offset = ((width - image.width) // 2, (height - image.height) // 2)
        canvas.paste(image, offset)
        canvas.save(
            dst,
            "JPEG",
            quality=92,
            optimize=True,
            progressive=True,
            subsampling=0,
        )

    return True


def main() -> int:
    built = 0
    for preview in PREVIEWS:
        src = preview["source"]
        dst = preview["output"]
        if not src.exists():
            print(f"missing source: {src}")
            continue

        did_build = fit_on_canvas(src, dst)
        built += int(did_build)
        status = "created" if did_build else "up-to-date"
        print(f"{status}: {src} -> {dst}")

    print(f"Done: {built}/{len(PREVIEWS)} social previews created.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
