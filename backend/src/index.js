import { loadEnvFile } from 'node:process';
import { createApp } from './app.js';
import { readSecurityConfig } from './config/security.js';
import { startRosBridge } from './ros.js';
import { RunRecorder } from './run_recorder.js';

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
const recorder = new RunRecorder();
app.server.listen(port, host, () => {
  console.log(`mBot2 JavaScript backend: http://${host}:${port}`);
});
const stopRos = await startRosBridge(app.store, robotNames, recorder);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  stopRos();
  await recorder.flush();
  await app.close();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
