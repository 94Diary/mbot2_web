const TZ = 'Asia/Bangkok';

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('th-TH', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDay(iso) {
  return new Date(iso).toLocaleDateString('th-TH', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function dayKey(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

export function fmtDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtRelative(iso) {
  if (!iso) return 'ไม่เคย';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'เมื่อสักครู่';
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม. ที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

export const RESULT = {
  ok: { label: 'ครบ', tone: 'go', color: 'var(--go)' },
  part: { label: 'บางตัว', tone: 'warn', color: 'var(--warn)' },
  stop: { label: 'หยุด', tone: 'red', color: 'var(--red-ink)' },
  live: { label: 'กำลังทำ', tone: 'orange', color: 'var(--orange)' },
};

export const LOG_LEVEL = {
  info: { label: 'ข้อมูล', tone: 'gray' },
  ok: { label: 'สำเร็จ', tone: 'go' },
  warn: { label: 'เตือน', tone: 'warn' },
  err: { label: 'ผิดพลาด', tone: 'red' },
};
