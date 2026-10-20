#!/usr/bin/env python3
"""Cắt 12 dải map của mini-game (backend/src/game) từ 1 ảnh composite.

Nguồn: 1 ảnh asset-pack ghép sẵn 12 dải cảnh quan xếp chồng theo chiều dọc trên nền
đen tuyền (vd bộ "computer-game-landscapes-collection"). Script tự dò ranh giới từng
dải bằng ngưỡng gần-đen thay vì hardcode toạ độ, để chạy lại được nếu đổi ảnh nguồn.

Usage:
    python3 scripts/slice-game-maps.py <đường-dẫn-ảnh-nguồn> [--out DIR] [--count N]

Output mặc định: frontend/public/game/maps/level-01.webp .. level-12.webp (khớp thứ
tự seed trong backend/prisma/seed.ts — dải trên cùng = level-01).
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

NEAR_BLACK_THRESHOLD = 12  # giá trị kênh màu tối đa dưới ngưỡng này coi là nền đen
ALPHA_FEATHER_LOW = 10  # dưới ngưỡng này: alpha = 0 (trong suốt hoàn toàn)
ALPHA_FEATHER_HIGH = 40  # trên ngưỡng này: alpha = 255 — khoảng giữa nội suy tuyến tính,
# tránh răng cưa cứng ở mép ngọn cỏ/đá khi ảnh gốc có viền anti-alias gần-đen.
EDGE_TRIM = 3  # bớt thêm vài px mép để loại viền mờ gần-đen
MAX_WIDTH = 1600  # canvas game dùng ~960px logic — 1600px dư cho HiDPI, giữ file nhẹ
WEBP_QUALITY = 85  # ảnh có alpha nên giữ chất lượng cao hơn 1 chút để không lỗ chỗ ở mép


def find_bands(mask_1d: "np.ndarray") -> list[tuple[int, int]]:
    """Tìm các đoạn (start, end) liên tục True trong mảng bool 1 chiều."""
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Đường dẫn ảnh composite nguồn (jpg/png)")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent.parent / "frontend" / "public" / "game" / "maps"),
        help="Thư mục xuất file (mặc định frontend/public/game/maps)",
    )
    parser.add_argument("--count", type=int, default=12, help="Số dải mong đợi (mặc định 12)")
    args = parser.parse_args()

    src_path = Path(args.source)
    if not src_path.exists():
        print(f"Không tìm thấy file: {src_path}", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    im = Image.open(src_path).convert("RGB")
    arr = np.array(im)
    h, w, _ = arr.shape
    print(f"Ảnh nguồn: {src_path.name} — {w}x{h}")

    row_max = arr.max(axis=(1, 2))
    row_bands = find_bands(row_max > NEAR_BLACK_THRESHOLD)
    # Bỏ các dải quá mỏng (vd viền JPEG 1px lẻ ở mép dưới) — dải nội dung thật luôn cao hàng trăm px.
    row_bands = [b for b in row_bands if (b[1] - b[0] + 1) >= 50]

    if len(row_bands) != args.count:
        print(
            f"CẢNH BÁO: dò được {len(row_bands)} dải, mong đợi {args.count}. "
            f"Kiểm tra lại NEAR_BLACK_THRESHOLD hoặc ảnh nguồn.",
            file=sys.stderr,
        )

    for idx, (y0, y1) in enumerate(row_bands, start=1):
        strip = arr[y0 : y1 + 1]
        col_max = strip.max(axis=(0, 2))
        col_mask = col_max > NEAR_BLACK_THRESHOLD
        xs = np.where(col_mask)[0]
        if len(xs) == 0:
            print(f"  Dải {idx}: rỗng, bỏ qua", file=sys.stderr)
            continue
        x0, x1 = int(xs.min()), int(xs.max())

        # Trim thêm EDGE_TRIM px mỗi phía (clamp trong biên ảnh) để bỏ viền mờ gần-đen.
        cy0 = min(y0 + EDGE_TRIM, y1)
        cy1 = max(y1 - EDGE_TRIM, cy0)
        cx0 = min(x0 + EDGE_TRIM, x1)
        cx1 = max(x1 - EDGE_TRIM, cx0)

        crop = im.crop((cx0, cy0, cx1 + 1, cy1 + 1))

        # Nền ảnh gốc là JPEG đặc (không có alpha) — vùng "đen" phía trên tán lá/đá chỉ là nền
        # composite, không phải bầu trời thật. Suy ra kênh alpha để vùng đó trong suốt, cho phép
        # game vẽ gradient bầu trời riêng (theo skyThemeKey) lộ ra phía sau — xem
        # frontend/src/components/game/sky-themes.ts.
        #
        # KHÔNG dùng ngưỡng độ sáng toàn cục (global threshold) — nội dung có vùng tối thật (đá hang
        # tối, nước xanh navy sâu, bóng đổ giữa khối pha lê) cũng tối ngang nền đen, sẽ bị thủng lỗ
        # oan nếu chỉ xét độ sáng từng pixel riêng lẻ. Dùng connected-component (scipy.ndimage.label)
        # trên mask "gần đen", chỉ những vùng THỰC SỰ nối liền ra mép ảnh mới coi là nền — vùng tối
        # nằm lọt bên trong hình (không chạm mép) luôn giữ nguyên, dù tối bằng hay hơn nền.
        crop_arr = np.array(crop.convert("RGB")).astype(np.uint8)
        brightness = crop_arr.max(axis=2).astype(np.float32)
        near_black = brightness < ALPHA_FEATHER_HIGH
        labels, num = ndi.label(near_black, structure=np.ones((3, 3)))
        border_labels = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
        border_labels.discard(0)
        is_background = np.isin(labels, list(border_labels)) if border_labels else np.zeros_like(near_black)

        alpha = np.where(
            is_background,
            np.clip((brightness - ALPHA_FEATHER_LOW) / (ALPHA_FEATHER_HIGH - ALPHA_FEATHER_LOW), 0.0, 1.0),
            1.0,
        )
        alpha_u8 = (alpha * 255).astype(np.uint8)
        rgba = np.dstack([crop_arr, alpha_u8])
        crop = Image.fromarray(rgba, mode="RGBA")

        if crop.width > MAX_WIDTH:
            ratio = MAX_WIDTH / crop.width
            crop = crop.resize((MAX_WIDTH, max(1, round(crop.height * ratio))), Image.LANCZOS)

        out_path = out_dir / f"level-{idx:02d}.webp"
        crop.save(out_path, "WEBP", quality=WEBP_QUALITY, method=6)
        size_kb = out_path.stat().st_size / 1024
        print(
            f"  Dải {idx:2d}: y[{y0}:{y1}] x[{x0}:{x1}] -> {out_path.name} "
            f"({crop.width}x{crop.height}, {size_kb:.0f} KB)"
        )

    print(f"Xong — {len(row_bands)} file tại {out_dir}")


if __name__ == "__main__":
    main()
