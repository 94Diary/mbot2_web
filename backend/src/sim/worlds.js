import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const NAME_RE = /^[A-Za-z0-9_]+$/;

export function worldDirs(wsPath) {
  return {
    installed: join(wsPath, 'install', 'mbot2_description', 'share', 'mbot2_description', 'worlds'),
    source: join(wsPath, 'src', 'mbot2_description', 'worlds'),
  };
}

function sdfNames(dir) {
  try {
    return new Set(readdirSync(dir).filter((f) => f.endsWith('.sdf')).map((f) => f.slice(0, -4)).filter((n) => NAME_RE.test(n)));
  } catch {
    return null;
  }
}

/**
 * Worlds the launch file can open (installed share) that still exist in the team's source.
 * The install folder keeps stale files from old builds, so source is the list of record.
 */
export function listWorlds(wsPath) {
  const { installed, source } = worldDirs(wsPath);
  const inInstall = sdfNames(installed);
  const inSource = sdfNames(source);
  if (!inInstall) return [];
  const names = inSource ? [...inInstall].filter((n) => inSource.has(n)) : [...inInstall];
  // เรียงตามเลขแบบคนอ่าน: Map1, Map1_Walled, Map2, …, Map10 · ตัวแรกเป็นค่าเริ่มต้นของฟอร์ม
  return names.sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
}
