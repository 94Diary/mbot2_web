import { Router } from 'express';
import { requirePerm } from '../../auth/middleware.js';
import { badRequest } from '../../http.js';

function validRobot(robot) {
  return robot === null || (typeof robot === 'string' && robot.trim().length > 0);
}

/** Read-only live telemetry (mounted under /api/v1/telemetry). */
export function createTelemetryRouter(store) {
  const router = Router();
  router.use(requirePerm('console.view'));

  router.get('/health', (_req, res) => res.json(store.health()));
  router.get('/team', (_req, res) => res.json(store.team()));
  router.get('/paths', (req, res) => {
    const robot = req.query.robot ?? null;
    if (!validRobot(robot)) throw badRequest('robot must be a single non-empty name');
    return res.json(store.paths.read(robot));
  });
  router.get('/goals', (_req, res) => res.json(store.goals()));
  router.get('/topics', (_req, res) => {
    try {
      const items = store.topics();
      if (items !== null) return res.json({ items });
    } catch (error) {
      console.error('ROS 2 topic discovery failed:', error);
    }
    return res.status(503).json({ error: { code: 'ROS_UNAVAILABLE', message: 'ROS 2 topic discovery unavailable' } });
  });
  router.get('/logs', (req, res) => {
    const limit = req.query.limit === undefined ? 200 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw badRequest('limit must be 1-1000');
    res.json({ items: store.logs(limit) });
  });
  router.get('/events', (req, res) => {
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    const afterId = req.query.after_id === undefined ? null : Number(req.query.after_id);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 ||
        (afterId !== null && (!Number.isInteger(afterId) || afterId < 0))) {
      throw badRequest('limit must be 1-200 and after_id must be a non-negative integer');
    }
    const robot = req.query.robot ?? null;
    if (!validRobot(robot)) throw badRequest('robot must be a single non-empty name');
    return res.json({ items: store.events(limit, afterId, robot) });
  });

  return router;
}
