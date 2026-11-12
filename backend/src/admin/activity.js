// ประวัติการใช้งาน (ดีไซน์ “ใครทำอะไรบนเว็บนี้ เมื่อไหร่”) = audit_log จัดหมวด + ตัวกรอง
const CATEGORIES = [
  ['account', 'บัญชี', /^(auth\.|user\.register|user\.password|user\.create_owner)/],
  ['machine', 'รันบนเครื่อง', /^sim\./],
  ['mission', 'ภารกิจ', /^mission\./],
  ['users', 'ผู้ใช้', /^(user\.|role\.|invite\.)/],
  ['content', 'เนื้อหา', /^(lesson\.|announce\.|message\.)/],
  ['system', 'ตั้งค่าและระบบ', /^(settings\.|backup\.)/],
];
const FAILED = /\.failed$|\.fail$/;
const RANGES = { today: 1, '7d': 7, all: null };

export const categoryOf = (action) => CATEGORIES.find(([, , re]) => re.test(action))?.[0] ?? 'system';
export const isRange = (r) => Object.hasOwn(RANGES, r);

export function activity(db, { range = '7d', q = '', actor = '', category = '', failed = false }) {
  const days = RANGES[range];
  const since = days ? new Date(Date.now() - days * 86400000).toISOString() : '0000';
  const rows = db.prepare(`SELECT a.*, u.display_name AS actor_name, u.avatar_color AS actor_color FROM audit_log a
    LEFT JOIN users u ON u.id = a.actor_id WHERE a.at >= ? ORDER BY a.id DESC LIMIT 2000`).all(since)
    .map((r) => ({ ...r, category: categoryOf(r.action), ok: !FAILED.test(r.action),
      before: r.before && JSON.parse(r.before), after: r.after && JSON.parse(r.after) }));
  const text = q.trim().toLowerCase();
  const byText = rows.filter((r) => !text || `${r.summary} ${r.actor_name ?? ''} ${r.action}`.toLowerCase().includes(text));
  const actorKey = (r) => r.actor_id ?? 'system';
  const facets = {
    actors: Object.values(byText.reduce((acc, r) => {
      const k = actorKey(r);
      acc[k] ??= { id: k, name: r.actor_name ?? (r.actor_id ? 'ผู้ใช้ที่ลบแล้ว' : 'ระบบ / ไม่ทราบ'), color: r.actor_color ?? null, n: 0 };
      acc[k].n += 1;
      return acc;
    }, {})),
    categories: CATEGORIES.map(([key, label]) => ({ key, label, n: byText.filter((r) => r.category === key).length })),
    failed: byText.filter((r) => !r.ok).length,
  };
  const items = byText.filter((r) => (!actor || actorKey(r) === actor) && (!category || r.category === category) && (!failed || !r.ok));
  return { items: items.slice(0, 300), total: items.length, facets };
}
