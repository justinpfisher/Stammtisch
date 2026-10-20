#!/usr/bin/env python3
"""Moody Cocktail Register display derivative from approved public JPEGs.

Never alters the original or the signed archive. No generative model, external
image request, person recognition or new service. Uncertain matting holds the
editorial derivative, not an otherwise eligible original photograph.
Requires pinned numpy and opencv-python-headless in the hosted publisher.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import cv2
import numpy as np

ASSET = re.compile(r"^(annal-[0-9a-f]{24}|[0-9a-f]{64})$")
SHA = re.compile(r"^[0-9a-f]{64}$")
STYLE_VERSION = "styled-v1"
MAX_BYTES = 524288
MAX_PIXELS = 1600 * 1600


def read_qualified_jpeg(path: Path, expected: str) -> np.ndarray:
    if path.is_symlink() or not path.is_file():
        raise ValueError("source_absent_or_symlink")
    data = path.read_bytes()
    if not (24 <= len(data) <= MAX_BYTES and data.startswith(b"\xff\xd8")
            and data.endswith(b"\xff\xd9")):
        raise ValueError("source_not_bounded_jpeg")
    if not SHA.fullmatch(expected) or hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("source_digest_mismatch")
    decoded = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if decoded is None or decoded.ndim != 3:
        raise ValueError("source_decode_failed")
    height, width = decoded.shape[:2]
    if not (180 <= width <= 1600 and 180 <= height <= 1600
            and width * height <= MAX_PIXELS):
        raise ValueError("source_dimensions_unqualified")
    return decoded


def foreground_mask(bgr: np.ndarray) -> np.ndarray | None:
    height, width = bgr.shape[:2]
    scale = min(1.0, 700 / max(height, width))
    sample = (cv2.resize(bgr, (round(width * scale), round(height * scale)),
                         interpolation=cv2.INTER_AREA) if scale < 1 else bgr)
    h, w = sample.shape[:2]
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    # The central drink is a hypothesis, not an identification of the subject.
    cv2.ellipse(mask, (int(w * .5), int(h * .54)),
                (int(w * .35), int(h * .46)), 0, 0, 360, cv2.GC_PR_FGD, -1)
    cv2.rectangle(mask, (int(w * .22), int(h * .18)),
                  (int(w * .77), int(h * .64)), cv2.GC_PR_FGD, -1)
    cv2.rectangle(mask, (int(w * .29), int(h * .91)),
                  (int(w * .71), h - 1), cv2.GC_PR_FGD, -1)
    band = max(4, int(w * .05))
    mask[:, :band] = cv2.GC_BGD
    mask[:, -band:] = cv2.GC_BGD
    mask[:max(3, int(h * .035)), :] = cv2.GC_BGD
    mask[int(h * .92):, :int(w * .22)] = cv2.GC_BGD
    mask[int(h * .92):, int(w * .78):] = cv2.GC_BGD
    cv2.ellipse(mask, (int(w * .49), int(h * .42)),
                (max(2, int(w * .12)), max(2, int(h * .1))),
                0, 0, 360, cv2.GC_FGD, -1)
    cv2.rectangle(mask, (int(w * .479), int(h * .67)),
                  (int(w * .505), int(h * .935)), cv2.GC_FGD, -1)
    hsv = cv2.cvtColor(sample, cv2.COLOR_BGR2HSV)
    y, x = np.indices((h, w))
    garnish = ((hsv[:, :, 1] > 28) & (x > .55 * w) &
               (x < .9 * w) & (y < .36 * h) & (y > .035 * h))
    mask[garnish & (mask == cv2.GC_PR_BGD)] = cv2.GC_PR_FGD
    cv2.setRNGSeed(33)
    try:
        cv2.grabCut(sample, mask, None, np.zeros((1, 65), np.float64),
                    np.zeros((1, 65), np.float64), 8, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return None
    matte = np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    matte = cv2.morphologyEx(matte, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    matte = cv2.morphologyEx(matte, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    components, labelled, stats, _ = cv2.connectedComponentsWithStats(matte, 8)
    if components <= 1:
        return None
    central = max(range(1, components), key=lambda i: stats[i, cv2.CC_STAT_AREA])
    matte = np.uint8(labelled == central)
    y, x = np.indices((h, w))
    matte[(y > h * .66) & (y < h * .755) &
          ((x < w * .32) | (x > w * .67))] = 0
    centre = matte[int(h * .37):int(h * .5), int(w * .39):int(w * .59)]
    if not (.08 < np.mean(matte) < .62 and centre.size and centre.mean() > .65):
        return None
    if scale < 1:
        matte = cv2.resize(matte, (width, height), interpolation=cv2.INTER_NEAREST)
    return matte


def studio_backdrop(bgr: np.ndarray) -> np.ndarray:
    height, width = bgr.shape[:2]
    y, x = np.mgrid[:height, :width]
    xf, yf = x / width, y / height
    # Abstract dark forest/walnut lighting, not a claimed new room or occasion.
    warm = np.exp(-((xf - .23) ** 2 / .08 + (yf - .32) ** 2 / .22))
    back = np.empty_like(bgr, np.float32)
    back[:] = (16, 21, 8)
    back += warm[:, :, None] * np.array((8, 18, 26), np.float32)[None, None, :]
    wood = np.clip((yf - .8) / .1, 0, 1)
    original_wood = bgr.astype(np.float32) * .23 + np.array((4, 15, 35), np.float32)[None, None, :]
    back = back * (1 - wood[:, :, None]) + wood[:, :, None] * original_wood
    for cx, cy, dx, dy, intensity in ((.13, .38, .04, .1, 55), (.11, .42, .015, .15, 25)):
        glow = np.exp(-(((xf - cx) / dx) ** 2 + ((yf - cy) / dy) ** 2) * 1.8) * intensity
        back += glow[:, :, None] * np.array((.23, .63, 1), np.float32)[None, None, :]
    cloth = np.exp(-((xf - .12) ** 2 / .024 + (yf - .78) ** 2 / .012))
    back = back * (1 - cloth[:, :, None] * .85) + cloth[:, :, None] * .85 * (30, 39, 18)
    return np.clip(back, 0, 255)


def create_editorial_jpeg(bgr: np.ndarray) -> bytes | None:
    matte = foreground_mask(bgr)
    if matte is None:
        return None
    matte = cv2.erode(matte, np.ones((2, 2), np.uint8))
    alpha = cv2.GaussianBlur(matte.astype(np.float32), (0, 0), 1.3)
    fore = np.clip((bgr.astype(np.float32) - 12) * 1.06 + 10, 0, 255)
    back = studio_backdrop(bgr)
    merged = np.uint8(np.clip(fore * alpha[:, :, None] + back * (1 - alpha[:, :, None]), 0, 255))
    ok, encoded = cv2.imencode(".jpg", merged,
                               (cv2.IMWRITE_JPEG_QUALITY, 87, cv2.IMWRITE_JPEG_OPTIMIZE, 1))
    if not ok or not (3000 < encoded.size < MAX_BYTES):
        return None
    return encoded.tobytes()


def entry_sources(index: dict):
    if not isinstance(index, dict) or index.get("schemaVersion") != 1:
        raise ValueError("invalid_signed_archive_shape")
    entries = index.get("entries")
    if not isinstance(entries, list) or len(entries) > 10000:
        raise ValueError("invalid_entry_collection")
    for entry in entries:
        if entry.get("category") != "cocktail":
            continue
        if entry.get("photo"):
            yield entry["id"], entry["photo"]["sha256"]
        for photo in entry.get("photos", []):
            yield photo["sha256"], photo["sha256"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default="data/annals-approved.json")
    ap.add_argument("--assets", default="assets/annals")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--verify-only", action="store_true")
    args = ap.parse_args()
    index = json.loads(Path(args.index).read_text(encoding="utf-8"))
    root = Path(args.assets)
    n = {"created": 0, "existing": 0, "held": 0}
    seen = set()
    for stem, digest in entry_sources(index):
        if not ASSET.fullmatch(stem) or not SHA.fullmatch(digest):
            raise ValueError("invalid_signed_photo_name")
        if stem in seen:
            continue
        seen.add(stem)
        original = root / f"{stem}.jpg"
        destination = root / f"{stem}-{STYLE_VERSION}.jpg"
        if destination.is_symlink():
            raise ValueError("style_output_symlink")
        if destination.exists() and not args.verify_only:
            n["existing"] += 1
            continue
        try:
            bgr = read_qualified_jpeg(original, digest)
            output = create_editorial_jpeg(bgr)
            if output is None:
                raise ValueError("insufficient_confidence")
        except (ValueError, OSError, cv2.error) as exc:
            n["held"] += 1
            if args.strict:
                raise RuntimeError("editorial_image_hold") from exc
            continue
        if not args.verify_only:
            destination.write_bytes(output)
        n["created"] += 1
    print(json.dumps({"photo_style": STYLE_VERSION, **n}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
