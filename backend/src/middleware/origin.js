// คำขอจากเบราว์เซอร์ต้องมาจาก origin ที่อนุญาต (กัน CSRF ร่วมกับ cookie SameSite=Lax)
// ไม่มี Origin = เครื่องมือเช่น curl ซึ่งไม่ได้ส่ง cookie ของเบราว์เซอร์ข้ามเว็บ
export function createOriginPolicy(allowedOrigins) {
  const origins = new Set(allowedOrigins);
  const allows = (origin) => origin === undefined || origins.has(origin);
  return {
    allows,
    middleware(request, response, next) {
      const origin = request.headers.origin;
      response.vary('Origin');
      if (!allows(origin)) {
        return response.status(403).json({ error: { code: 'ORIGIN_DENIED', message: 'Origin not allowed' } });
      }
      if (origin !== undefined) {
        response.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' });
      }
      if (request.method === 'OPTIONS' && origin !== undefined) {
        return response.set({
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }).sendStatus(204);
      }
      return next();
    },
  };
}
