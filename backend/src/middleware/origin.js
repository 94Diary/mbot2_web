export function createOriginPolicy(allowedOrigins) {
  const origins = new Set(allowedOrigins);
  const allows = (origin) => origin === undefined || origins.has(origin);
  return {
    allows,
    middleware(request, response, next) {
      const origin = request.headers.origin;
      response.vary('Origin');
      if (!allows(origin)) return response.status(403).json({ error: 'Origin not allowed' });
      if (origin !== undefined) response.set('Access-Control-Allow-Origin', origin);
      if (request.method === 'OPTIONS' && origin !== undefined) {
        return response.set({
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization',
        }).sendStatus(204);
      }
      return next();
    },
  };
}
