export class ApiError extends Error {
  constructor(status, error = {}) {
    super(error.message || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    this.status = status;
    this.code = error.code || 'UNKNOWN';
    this.fields = error.fields || null;
    this.detail = error;
  }
}

const listeners = new Set();
/** Lets the app react globally (e.g. 503 MAINTENANCE, 401 after a session ends). */
export function onApiError(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** fetch wrapper for /api/v1: JSON in/out, cookie session, typed errors. */
export async function api(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause;
    throw new ApiError(0, { code: 'NETWORK', message: 'ติดต่อ backend ไม่ได้ ตรวจว่ารัน npm start อยู่' });
  }
  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new ApiError(response.status, data?.error ?? { message: `HTTP ${response.status}` });
    for (const fn of listeners) fn(error);
    throw error;
  }
  return data;
}

export function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
