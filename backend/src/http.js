export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function sendError(res, status, code, message, fields) {
  return res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
}

export const badRequest = (message, fields) => new HttpError(400, 'VALIDATION', message, fields);
export const forbidden = (message = 'ไม่มีสิทธิ์ทำสิ่งนี้') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'ไม่พบข้อมูล') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (code, message) => new HttpError(409, code, message);

/** Express error handler: HttpError → JSON, anything else → 500 without internals. */
export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) return sendError(res, error.status, error.code, error.message, error.fields);
  if (error?.type === 'entity.parse.failed') return sendError(res, 400, 'VALIDATION', 'รูปแบบข้อมูลไม่ถูกต้อง');
  console.error(error);
  return sendError(res, 500, 'INTERNAL', 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์ ลองใหม่อีกครั้ง');
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    try {
      out[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // ignore malformed cookie values
    }
  }
  return out;
}

export const isNonEmptyString = (value, max = 200) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
