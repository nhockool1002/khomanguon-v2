const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
};

// WP lưu title/excerpt/comment_content dạng plain text nhưng entity-encode ký tự đặc biệt
// (vd "&#8211;" cho dấu gạch ngang) — cần decode trước khi render như plain text ở FE v2
// (khác post_content, vốn render qua dangerouslySetInnerHTML nên trình duyệt tự decode).
export function decodeWpEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (full: string, name: string) => NAMED_ENTITIES[name] ?? full);
}

const BLOCK_TAG_START = /^\s*<(p|div|h[1-6]|ul|ol|li|blockquote|table|pre|figure|section|article|header|footer|iframe|hr)\b/i;

// Tương đương rút gọn của wpautop() — WP Classic Editor lưu content dạng text thuần với
// dòng trống ngăn đoạn văn (WP tự bọc <p> lúc render qua the_content filter). v2 render
// contentHtml trực tiếp bằng dangerouslySetInnerHTML nên phải tự bọc <p>/<br> ở bước migrate,
// nếu không toàn bộ đoạn văn sẽ dính liền thành 1 khối không xuống dòng.
export function wpautop(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const blocks = normalized.split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (BLOCK_TAG_START.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br />\n')}</p>`;
    })
    .filter(Boolean)
    .join('\n\n');
}

const LEGACY_IMG_SRC_PATTERN = /https?:\/\/khomanguon\.org\/wp-content\/uploads\/([^"'\s)]+)/gi;

// contentHtml đã migrate chỉ chứa <img src="https://khomanguon.org/wp-content/uploads/{yyyy}/{mm}/{file}">
// (bản gốc size-full, đã xác nhận không có srcset) — thay bằng URL mới theo map đã upload ở bước attachments.
export function rewriteContentImageUrls(
  contentHtml: string,
  resolveNewUrl: (relativePath: string) => string | null,
): string {
  return contentHtml.replace(LEGACY_IMG_SRC_PATTERN, (full: string, relativePath: string) => {
    const newUrl = resolveNewUrl(decodeURIComponent(relativePath));
    return newUrl ?? full;
  });
}
