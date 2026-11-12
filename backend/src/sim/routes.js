import { Router } from 'express';
import { requirePerm } from '../auth/middleware.js';
import { auditFor } from '../db/audit.js';
import { previewCommands, validateStart } from './commands.js';

export function createSimRouter({ db, service, listWorlds }) {
  const router = Router();
  const { runner } = service;

  router.get('/sim/worlds', requirePerm('console.use'), (_req, res) => {
    res.json({ items: listWorlds() });
  });

  router.get('/sim/state', requirePerm('console.view'), (_req, res) => {
    res.json({ ...runner.state(), lines: runner.recentLines(200) });
  });

  router.post('/sim/preview', requirePerm('console.use'), (req, res) => {
    res.json({ commands: previewCommands(validateStart(req.body, listWorlds())) });
  });

  router.post('/sim/build', requirePerm('console.use'), (req, res) => {
    const state = runner.build();
    auditFor(db, req)({ action: 'sim.build', targetType: 'sim', summary: 'Build โค้ดหุ่น (colcon build)' });
    res.status(202).json(state);
  });

  router.post('/sim/start', requirePerm('console.use'), (req, res) => {
    const options = validateStart(req.body, listWorlds());
    const state = service.start(options, req.user.id);
    auditFor(db, req)({ action: 'sim.start', targetType: 'sim', targetId: options.world,
      summary: `รันซิม ${options.count} ตัว สนาม ${options.world}`, after: options });
    res.status(202).json(state);
  });

  router.post('/sim/stop', requirePerm('console.stop'), async (req, res) => {
    const wasActive = runner.state().state !== 'idle';
    const stopping = service.stop();
    if (wasActive) auditFor(db, req)({ action: 'sim.stop', targetType: 'sim', summary: 'หยุดซิมทุกตัว' });
    if (req.query.wait === '1') await stopping;
    res.status(202).json(runner.state());
  });

  return router;
}
