import type { ReactNode } from "react";

// Khớp token do MentionTextarea tự chèn: "@[Tên hiển thị](userId)" — xem
// backend/src/comments/comments.service.ts (MENTION_PATTERN, cùng quy ước).
const MENTION_PATTERN = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g;

export function renderMentionText(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of content.matchAll(MENTION_PATTERN)) {
    const [full, displayName] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(content.slice(lastIndex, index));
    parts.push(
      <span key={`mention-${key++}`} className="font-medium text-[#1d3557]">
        @{displayName}
      </span>,
    );
    lastIndex = index + full.length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}
