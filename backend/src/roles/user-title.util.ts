import type { RoleUserTitleConfig } from './permissions.constant';

// User có nhiều role thì áp cấu hình "ưu tiên nhất" trong số các role đang giữ — không phải role
// primary (khác với style tên hiển thị ở style-role.util.ts): độ dài lấy MAX, HTML chỉ cần 1 role
// cho phép, cooldown null (không giới hạn) thắng mọi số ngày cụ thể. Tránh user bị Mod cấm HTML dù
// đồng thời là Admin ở role khác.
export function resolveUserTitleConfig(
  roles: RoleUserTitleConfig[],
): RoleUserTitleConfig {
  if (roles.length === 0) {
    return { cooldownDays: 60, allowHtml: false, maxLength: 150 };
  }
  return {
    allowHtml: roles.some((r) => r.allowHtml),
    maxLength: Math.max(...roles.map((r) => r.maxLength)),
    cooldownDays: roles.some((r) => r.cooldownDays === null)
      ? null
      : Math.min(...roles.map((r) => r.cooldownDays as number)),
  };
}
