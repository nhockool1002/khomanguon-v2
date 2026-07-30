import { buildUniqueSlug, slugify } from './slugify';

describe('slugify', () => {
  it('bỏ dấu tiếng Việt và thay khoảng trắng bằng gạch nối', () => {
    expect(slugify('Game Mobile Đột Kích - Server Test!')).toBe(
      'game-mobile-dot-kich-server-test',
    );
  });

  it('gộp nhiều gạch nối liên tiếp và cắt gạch nối ở đầu/cuối', () => {
    expect(slugify('  Hà Nội  --  2026  ')).toBe('ha-noi-2026');
  });
});

describe('buildUniqueSlug', () => {
  it('trả về slug gốc nếu chưa tồn tại', async () => {
    const slug = await buildUniqueSlug('Tiêu đề mới', () =>
      Promise.resolve(false),
    );
    expect(slug).toBe('tieu-de-moi');
  });

  it('thêm hậu tố -2, -3... khi slug đã bị trùng', async () => {
    const taken = new Set(['tieu-de', 'tieu-de-2']);
    const slug = await buildUniqueSlug('Tiêu đề', (c) =>
      Promise.resolve(taken.has(c)),
    );
    expect(slug).toBe('tieu-de-3');
  });
});
