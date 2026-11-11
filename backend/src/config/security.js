export const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
export const TELEMETRY_PROTOCOL = 'mbot2.telemetry.v1';

export function validateTelemetryToken(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
    throw new Error('Set MBOT2_API_TOKEN to a 64-character lowercase hex token.');
  }
  return token;
}

export function readSecurityConfig(env) {
  const host = env.HOST || '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('HOST must be a loopback address for this local backend.');
  }
  const origins = env.MBOT2_CORS_ORIGINS === undefined
    ? DEFAULT_ORIGINS
    : env.MBOT2_CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
  return { host, origins, token: validateTelemetryToken(env.MBOT2_API_TOKEN) };
}
