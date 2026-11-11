import { loadEnvFile } from 'node:process';
import { createApp } from './app.js';
import { readSecurityConfig } from './config/security.js';
import { startRosBridge } from './modules/telemetry/ros.js';

try {
  loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const { host, origins, token } = readSecurityConfig(process.env);
const port = Number(process.env.PORT || 8000);
const robotNames = (process.env.MBOT2_ROBOTS || 'mbot1,mbot2,mbot3')
  .split(',').map((name) => name.trim()).filter(Boolean);
const app = createApp(undefined, origins, token);
app.server.listen(port, host, () => {
  console.log(`mBot2 JavaScript backend: http://${host}:${port}`);
});
const stopRos = await startRosBridge(app.store, robotNames);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  stopRos();
  await app.close();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
