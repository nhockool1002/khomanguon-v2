#!/usr/bin/env python3
"""Cắt frame đi bộ của nhân vật người chơi (backend/src/game) từ 1 sprite sheet dạng lưới trên nền
trắng (vd asset pack Viking rìu/kiếm). Nền KHÔNG có alpha sẵn (RGB thuần, trắng đặc) — script tự suy
ra alpha bằng connected-component từ mép ảnh (giống scripts/slice-game-maps.py, nhưng xét nền GẦN
TRẮNG thay vì gần đen), để không thủng lỗ oan vào các mảng sáng màu THẬT trong nhân vật (sừng mũ
trắng ngà, tròng mắt, điểm sáng trên áo giáp...).

Usage:
    python3 scripts/slice-character-sprites.py <ảnh> --cols N --rows N --cells "r0c0,r0c1,r1c2" \
        --out-prefix frontend/public/game/characters/viking-axe/frame

Mỗi cell được chỉ định (theo chỉ số hàng/cột 0-based, đọc trái→phải, trên→dưới) xuất ra 1 file
WebP riêng, đánh số theo đúng thứ tự liệt kê trong --cells (frame-01.webp, frame-02.webp, ...).
"""
import argparse
import sys
from pathlib import Path

try:
    import numpy as np
    import scipy.ndimage as ndi
    from PIL import Image
except ImportError:
    print("Cần cài: pip3 install --break-system-packages pillow numpy scipy", file=sys.stderr)
    raise

NEAR_WHITE_FLOOD_THRESHOLD = 245  # giá trị min kênh màu TRÊN ngưỡng này mới coi là ứng viên nền trắng
ALPHA_FEATHER_LOW = 235  # dưới ngưỡng này (trong vùng đã xác định là nền): alpha = 0
ALPHA_FEATHER_HIGH = 252  # trên ngưỡng này: alpha = 255 — feather mép cho mượt, đỡ răng cưa
EDGE_TRIM = 2
WEBP_QUALITY = 90


def find_bands(mask_1d) -> list[tuple[int, int]]:
    bands = []
    start = None
    for i, v in enumerate(mask_1d):
        if v and start is None:
            start = i
        elif not v and start is not None:
            bands.append((start, i - 1))
            start = None
    if start is not None:
        bands.append((start, len(mask_1d) - 1))
    return bands


def detect_grid(arr: "np.ndarray") -> tuple[list[tuple[int, int]], list[tuple[int, int]]]:
    is_white = (arr > 245).all(axis=2)
    col_bands = find_bands(~is_white.all(axis=0))
    row_bands = find_bands(~is_white.all(axis=1))
    return col_bands, row_bands


def cutout_alpha(cell_arr: "np.ndarray") -> "np.ndarray":
    """RGB -> RGBA, nền trắng nối liền ra mép crop thành trong suốt (connected-component từ viền)."""
    min_channel = cell_arr.min(axis=2).astype(np.float32)
    near_white = min_channel > NEAR_WHITE_FLOOD_THRESHOLD
    labels, _ = ndi.label(near_white, structure=np.ones((3, 3)))
    border_labels = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border_labels.discard(0)
    is_background = np.isin(labels, list(border_labels)) if border_labels else np.zeros_like(near_white)

    # Alpha nghịch với "độ trắng" trong vùng nền đã xác định — càng trắng càng trong suốt.
    whiteness = min_channel
    alpha = np.where(
        is_background,
        1.0 - np.clip((whiteness - ALPHA_FEATHER_LOW) / (ALPHA_FEATHER_HIGH - ALPHA_FEATHER_LOW), 0.0, 1.0),
        1.0,
    )
    alpha_u8 = (alpha * 255).astype(np.uint8)
    return np.dstack([cell_arr, alpha_u8])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("--cells", required=True, help='vd "r0c0,r0c1,r0c4" — thứ tự xuất file')
    parser.add_argument("--out-prefix", required=True, help="vd frontend/public/game/characters/viking-axe/frame")
    args = parser.parse_args()

    im = Image.open(args.source).convert("RGB")
    arr = np.array(im)
    col_bands, row_bands = detect_grid(arr)
    print(f"Dò được {len(col_bands)} cột x {len(row_bands)} hàng")

    out_prefix = Path(args.out_prefix)
    out_prefix.parent.mkdir(parents=True, exist_ok=True)

    cells = [c.strip() for c in args.cells.split(",")]
    for i, cell in enumerate(cells, start=1):
        r = int(cell.split("c")[0][1:])
        c = int(cell.split("c")[1])
        y0, y1 = row_bands[r]
        x0, x1 = col_bands[c]
        y0, y1 = max(0, y0 - EDGE_TRIM), min(arr.shape[0] - 1, y1 + EDGE_TRIM)
        x0, x1 = max(0, x0 - EDGE_TRIM), min(arr.shape[1] - 1, x1 + EDGE_TRIM)

        cell_arr = arr[y0 : y1 + 1, x0 : x1 + 1]
        rgba = cutout_alpha(cell_arr)
        out_im = Image.fromarray(rgba, mode="RGBA")

        out_path = Path(f"{out_prefix}-{i:02d}.webp")
        out_im.save(out_path, "WEBP", quality=WEBP_QUALITY, method=6)
        print(f"  {cell} (y[{y0}:{y1}] x[{x0}:{x1}]) -> {out_path} ({out_im.width}x{out_im.height})")


if __name__ == "__main__":
    main()
