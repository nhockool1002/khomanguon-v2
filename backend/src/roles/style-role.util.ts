// User thuộc nhiều role thì tự chọn 1 role (User.primaryRoleId) để áp style hiển thị tên — không
// chọn thì fallback role gán sớm nhất (mảng `roles` phải truyền vào theo thứ tự role.createdAt asc).
export function resolveStyleRoleSlug(
  primaryRoleId: string | null,
  roles: { roleId: string; role: { slug: string } }[],
): string | null {
  if (roles.length === 0) return null;
  const primary = primaryRoleId
    ? roles.find((r) => r.roleId === primaryRoleId)
    : undefined;
  return (primary ?? roles[0]).role.slug;
}
