#!/usr/bin/env python3
"""Cắt sprite quái (hazard monster di chuyển trong map — khác "monster" kiểu MONSTER_CATCH đã có)
từ 2 kiểu ảnh nguồn:

  --grid: lưới đều N cột x M hàng trên nền MÀU ĐẶC đồng nhất (vd ảnh "MONSTERS OBJECT" 5x4). Dò nền
    bằng khoảng cách màu cố định tới màu nền lấy mẫu ở góc ảnh (nhanh, đủ chính xác vì nền phẳng).

  --freeform: nhiều sprite đặt tự do trên nền GRADIENT (vd ảnh 8 quái trên nền xanh toả sáng giữa).
    Nền không phẳng nên không thể so màu cố định — phải flood-fill từ mép ảnh, mỗi bước chỉ lan tiếp
    nếu màu lệch so với pixel liền kề (đã thuộc vùng nền) nằm trong ngưỡng tolerance, nhờ vậy "trôi"
    theo đúng gradient mà vẫn dừng lại ở viền đen nét vẽ (nhảy màu đột ngột). Sau khi có mask nền,
    phần còn lại (foreground) được tách thành từng cụm liên thông (scipy.ndimage.label) = từng sprite
    riêng; cụm quá nhỏ/quá dẹt/độ bão hoà thấp (bóng đổ ellipse mờ dưới chân) bị loại.

Usage:
    python3 scripts/slice-monster-sprites.py grid <ảnh> --cols 5 --rows 4 \
        --out-prefix frontend/public/game/monsters/pack-a/monster
    python3 scripts/slice-monster-sprites.py freeform <ảnh> \
        --out-prefix frontend/public/game/monsters/pack-c/monster
"""
import argparse
import sys
from collections import deque
from pathlib import Path

try:
    import numpy as np
    import scipy.ndimage as ndi
    from PIL import Image
except ImportError:
    print("Cần cài: pip3 install --break-system-packages pillow numpy scipy", file=sys.stderr)
    raise

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


def save_rgba(rgb: "np.ndarray", alpha: "np.ndarray", out_path: Path) -> None:
    rgba = np.dstack([rgb, alpha])
    Image.fromarray(rgba, mode="RGBA").save(out_path, "WEBP", quality=WEBP_QUALITY, method=6)


# ───────────────────────── grid (nền màu đặc, phẳng) ─────────────────────────


def cmd_grid(args: argparse.Namespace) -> None:
    im = Image.open(args.source).convert("RGB")
    arr = np.array(im)
    # float64 bắt buộc — int16 bị tràn số khi bình phương rồi cộng 3 kênh (tối đa ~195075 > 32767),
    # sqrt(giá trị âm do tràn) ra NaN, làm content mask sai lệch ngẫu nhiên (lỗi thật đã gặp).
    bg = arr[2, 2].astype(np.float64)  # lấy mẫu góc, lùi vài px tránh viền nén webp
    dist = np.sqrt(((arr.astype(np.float64) - bg) ** 2).sum(axis=2))
    content = dist > args.threshold

    row_bands = find_bands(content.any(axis=1))
    # Dòng tiêu đề chữ ("MONSTERS OBJECT") tạo thành 1 "hàng" riêng ở trên cùng — loại bỏ hàng có
    # chiều cao bất thường nhỏ hơn hẳn các hàng sprite thật (chữ mảnh hơn nhiều so với khối sprite).
    if row_bands:
        heights = [b[1] - b[0] + 1 for b in row_bands]
        median_h = sorted(heights)[len(heights) // 2]
        row_bands = [b for b in row_bands if (b[1] - b[0] + 1) > median_h * 0.4]

    # Lỗi đã gặp: dò cột bằng content.any(axis=0) trên TOÀN BỘ chiều cao ảnh — vài pixel lẻ của dòng
    # tiêu đề chữ (đã bị loại khỏi row_bands ở trên nhưng vẫn còn tính vào content) vô tình "bắc cầu"
    # nối liền 2 cột sprite lẽ ra tách biệt, làm dò thiếu cột. Phải giới hạn vùng tính cột đúng bằng
    # khoảng y của các hàng sprite thật (đã lọc), không lấy nguyên ảnh.
    sprite_y0, sprite_y1 = row_bands[0][0], row_bands[-1][1]
    col_bands = find_bands(content[sprite_y0 : sprite_y1 + 1, :].any(axis=0))

    print(f"Dò được {len(col_bands)} cột x {len(row_bands)} hàng (sau khi loại tiêu đề)")
    if len(col_bands) != args.cols or len(row_bands) != args.rows:
        print(f"CẢNH BÁO: kỳ vọng {args.cols}x{args.rows}, dò được {len(col_bands)}x{len(row_bands)}", file=sys.stderr)

    out_prefix = Path(args.out_prefix)
    out_prefix.parent.mkdir(parents=True, exist_ok=True)
    idx = 1
    for r0, r1 in row_bands:
        for c0, c1 in col_bands:
            y0, y1 = max(0, r0 - EDGE_TRIM), min(arr.shape[0] - 1, r1 + EDGE_TRIM)
            x0, x1 = max(0, c0 - EDGE_TRIM), min(arr.shape[1] - 1, c1 + EDGE_TRIM)
            cell = arr[y0 : y1 + 1, x0 : x1 + 1]
            cell_dist = np.sqrt(((cell.astype(np.float64) - bg) ** 2).sum(axis=2))
            # feather nhẹ ở mép cho đỡ răng cưa, giữ alpha=255 ngay khi lệch nền rõ ràng
            alpha = np.clip((cell_dist - args.threshold * 0.6) / (args.threshold * 0.5), 0, 1)
            alpha_u8 = (alpha * 255).astype(np.uint8)
            out_path = Path(f"{out_prefix}-{idx:02d}.webp")
            save_rgba(cell, alpha_u8, out_path)
            print(f"  cell r[{y0}:{y1}] c[{x0}:{x1}] -> {out_path} ({cell.shape[1]}x{cell.shape[0]})")
            idx += 1


# ───────────────────────── freeform (nền gradient) ─────────────────────────


def flood_fill_background_mask(arr: "np.ndarray", tolerance: float) -> "np.ndarray":
    """BFS từ mép ảnh — lan tiếp nếu lệch màu so với pixel liền kề ĐÃ thuộc nền <= tolerance."""
    h, w, _ = arr.shape
    arr_i = arr.astype(np.int32)
    visited = np.zeros((h, w), dtype=bool)
    q: deque = deque()

    def push(y: int, x: int) -> None:
        if not visited[y, x]:
            visited[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)

    tol2 = tolerance * tolerance
    while q:
        y, x = q.popleft()
        cur = arr_i[y, x]
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                diff = arr_i[ny, nx] - cur
                if int(diff[0]) ** 2 + int(diff[1]) ** 2 + int(diff[2]) ** 2 <= tol2:
                    visited[ny, nx] = True
                    q.append((ny, nx))
    return visited


def cmd_freeform(args: argparse.Namespace) -> None:
    im = Image.open(args.source).convert("RGB")
    arr = np.array(im)
    print(f"Flood-fill nền ({arr.shape[1]}x{arr.shape[0]}, tolerance={args.tolerance})...")
    bg_mask = flood_fill_background_mask(arr, args.tolerance)
    fg_mask = ~bg_mask

    labels, num = ndi.label(fg_mask, structure=np.ones((3, 3)))
    print(f"Tìm được {num} cụm liên thông — lọc theo diện tích + độ bão hoà màu")

    out_prefix = Path(args.out_prefix)
    out_prefix.parent.mkdir(parents=True, exist_ok=True)
    idx = 1
    for label_id in range(1, num + 1):
        ys, xs = np.where(labels == label_id)
        area = len(ys)
        if area < args.min_area:
            continue
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        # Bóng đổ: ellipse dẹt (bề ngang >> bề cao) + bão hoà thấp (gần như 1 tông xám-xanh mờ) —
        # loại ra, chỉ giữ cụm có dáng sprite thật (gần vuông hơn, màu sặc sỡ, có viền đen rõ).
        aspect = bw / max(bh, 1)
        cell = arr[y0 : y1 + 1, x0 : x1 + 1]
        cell_max = cell.max(axis=2).astype(np.int16)
        cell_min = cell.min(axis=2).astype(np.int16)
        saturation_proxy = float((cell_max - cell_min).mean())
        has_dark_outline = bool((cell_max < 60).any())  # sprite thật luôn có viền đen/near-black rõ
        if aspect > 2.2 or (saturation_proxy < 18 and not has_dark_outline):
            print(f"  (bỏ cụm #{label_id}: area={area} aspect={aspect:.2f} sat={saturation_proxy:.1f} — nghi là bóng đổ)")
            continue

        py0, py1 = max(0, y0 - EDGE_TRIM), min(arr.shape[0] - 1, y1 + EDGE_TRIM)
        px0, px1 = max(0, x0 - EDGE_TRIM), min(arr.shape[1] - 1, x1 + EDGE_TRIM)
        crop_rgb = arr[py0 : py1 + 1, px0 : px1 + 1]
        crop_fg = fg_mask[py0 : py1 + 1, px0 : px1 + 1]
        alpha = (crop_fg.astype(np.uint8)) * 255
        out_path = Path(f"{out_prefix}-{idx:02d}.webp")
        save_rgba(crop_rgb, alpha, out_path)
        print(f"  cụm #{label_id} area={area} -> {out_path} ({crop_rgb.shape[1]}x{crop_rgb.shape[0]})")
        idx += 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="mode", required=True)

    p_grid = sub.add_parser("grid")
    p_grid.add_argument("source")
    p_grid.add_argument("--cols", type=int, required=True)
    p_grid.add_argument("--rows", type=int, required=True)
    p_grid.add_argument("--threshold", type=float, default=30.0)
    p_grid.add_argument("--out-prefix", required=True)
    p_grid.set_defaults(func=cmd_grid)

    p_free = sub.add_parser("freeform")
    p_free.add_argument("source")
    p_free.add_argument("--tolerance", type=float, default=16.0)
    p_free.add_argument("--min-area", type=int, default=400)
    p_free.add_argument("--out-prefix", required=True)
    p_free.set_defaults(func=cmd_freeform)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
