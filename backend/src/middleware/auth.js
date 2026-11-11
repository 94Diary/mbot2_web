import { timingSafeEqual } from 'node:crypto';
import { TELEMETRY_PROTOCOL, validateTelemetryToken } from '../config/security.js';

export function createTelemetryAuth(token) {
  const expected = Buffer.from(validateTelemetryToken(token), 'hex');
  const matches = (candidate) => typeof candidate === 'string' &&
    /^[0-9a-f]{64}$/.test(candidate) && timingSafeEqual(expected, Buffer.from(candidate, 'hex'));
  const hasBearerToken = (request) => {
    const bearer = /^Bearer ([0-9a-f]{64})$/i.exec(request.headers.authorization ?? '');
    return matches(bearer?.[1]);
  };

  return {
    requireToken(request, response, next) {
      if (hasBearerToken(request)) return next();
      return response.set('WWW-Authenticate', 'Bearer')
        .status(401).json({ error: 'Telemetry token required' });
    },
    allowsWebSocket(request) {
      if (hasBearerToken(request)) return true;
      const protocols = (request.headers['sec-websocket-protocol'] ?? '')
        .split(',').map((protocol) => protocol.trim());
      return protocols.includes(TELEMETRY_PROTOCOL) &&
        protocols.some((protocol) => protocol.startsWith('mbot2.token.') &&
          matches(protocol.slice('mbot2.token.'.length)));
    },
  };
}
