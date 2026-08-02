// Parser tối giản CHỈ đủ đọc format `src_capabilities` của WP (usermeta) —
// vd: a:1:{s:13:"administrator";b:1;}  hoặc  a:2:{s:6:"editor";b:1;s:11:"contributor";b:1;}
// Không phải bộ giải mã PHP serialize đầy đủ — không cần vì đây là dữ liệu nguồn cố định, tin cậy.
export function extractWpCapabilityRoles(serialized: string): string[] {
  const roles: string[] = [];
  const stringEntryPattern = /s:\d+:"([^"]+)";b:1;/g;
  let match: RegExpExecArray | null;
  while ((match = stringEntryPattern.exec(serialized)) !== null) {
    roles.push(match[1]);
  }
  return roles;
}
