import { Router } from 'express';

function validRobot(robot) {
  return robot === null || (typeof robot === 'string' && robot.trim().length > 0);
}

export function createTelemetryRouter(store) {
  const router = Router();

  router.get('/health', (_req, res) => res.json(store.health()));
  router.get('/team', (_req, res) => res.json(store.team()));
  router.get('/paths', (req, res) => {
    const robot = req.query.robot ?? null;
    if (!validRobot(robot)) return res.status(400).json({ error: 'robot must be a single non-empty name' });
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
    return res.status(503).json({ error: 'ROS 2 topic discovery unavailable' });
  });
  router.get('/events', (req, res) => {
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    const afterId = req.query.after_id === undefined ? null : Number(req.query.after_id);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 ||
        (afterId !== null && (!Number.isInteger(afterId) || afterId < 0))) {
      return res.status(400).json({ error: 'limit must be 1-200 and after_id must be a non-negative integer' });
    }
    const robot = req.query.robot ?? null;
    if (!validRobot(robot)) {
      return res.status(400).json({ error: 'robot must be a single non-empty name' });
    }
    return res.json({ items: store.events(limit, afterId, robot) });
  });

  return router;
}
