// แปลง team state ของ ROS เป็นรูปแบบแผนที่เดียวที่เว็บใช้ทั้งตอนสดและตอนเปิดประวัติ
// (อิง map.json ใน docs/data-model.md)
export const GOAL_STATES = new Set(['GOAL_REACHED']);
const DEAD_END_OFFSET_M = 0.18;

const finite = (value) => Number.isFinite(value);

function branchEntries(junction) {
  const branches = junction?.branches;
  if (!branches || typeof branches !== 'object') return [];
  return Object.entries(branches).filter(([, branch]) => branch && typeof branch === 'object');
}

const STUB_M = 0.22;

/** กิ่งที่เห็นแล้วแต่ยังไม่มีใครเข้า (ดีไซน์: เส้นประสั้น ๆ ออกจากทางแยก) */
function openStubsOf(junction) {
  return branchEntries(junction)
    .filter(([, b]) => b.status === 'OPEN' && b.leads_to == null && !(Array.isArray(b.visited_by) && b.visited_by.length))
    .map(([key, b]) => {
      const heading = finite(b.heading) ? b.heading : Number(key) * (Math.PI / 2);
      return [[junction.x, junction.y], [junction.x + Math.cos(heading) * STUB_M, junction.y + Math.sin(heading) * STUB_M]];
    });
}

function deadEndsOf(junction) {
  return branchEntries(junction)
    .filter(([, branch]) => branch.status === 'BLOCKED')
    .map(([key, branch]) => {
      const heading = finite(branch.heading) ? branch.heading : Number(key) * (Math.PI / 2);
      return {
        junction: junction.id ?? null,
        at: [junction.x + Math.cos(heading) * DEAD_END_OFFSET_M, junction.y + Math.sin(heading) * DEAD_END_OFFSET_M],
        by: Array.isArray(branch.visited_by) ? branch.visited_by[0] ?? null : null,
      };
    });
}

// ชนิดของจุดในแผนที่ทีม (coordinator_parts/map_assignments.py): START, GOAL, JUNCTION, CORNER, DEAD_END
// ไม่มี kind = ข้อมูลรุ่นเก่า ถือเป็นทางแยก
const JUNCTION_KINDS = new Set(['JUNCTION', undefined, null]);
const SAME_SPOT_M = 0.25;

/** One marker per place: a DEAD_END node and the BLOCKED branch pointing at it are the same dead end. */
function uniqueByDistance(items) {
  const out = [];
  for (const item of items) {
    if (!out.some((o) => Math.hypot(o.at[0] - item.at[0], o.at[1] - item.at[1]) <= SAME_SPOT_M)) out.push(item);
  }
  return out;
}

export function buildMap(team, paths) {
  const data = team && typeof team === 'object' ? team : {};
  const nodeList = Array.isArray(data.junctions) ? data.junctions : [];
  const valid = nodeList.filter((j) => j && finite(j.x) && finite(j.y));
  const ofKind = (kind) => valid.filter((j) => j.kind === kind);
  const junctions = valid.filter((j) => JUNCTION_KINDS.has(j.kind));
  const robots = {};
  for (const [name, pose] of Object.entries(data.robots && typeof data.robots === 'object' ? data.robots : {})) {
    if (pose && finite(pose.x) && finite(pose.y)) {
      robots[name] = { x: pose.x, y: pose.y, heading: finite(pose.heading) ? pose.heading : null, state: pose.state ?? null };
    }
  }
  const goalNode = ofKind('GOAL')[0];
  let goal = null;
  if (data.goal && finite(data.goal.x) && finite(data.goal.y)) {
    goal = { at: [data.goal.x, data.goal.y], by: data.goal.robot ?? data.goal.found_by ?? null };
  } else if (goalNode) {
    goal = { at: [goalNode.x, goalNode.y], by: null };
  }
  const startNode = ofKind('START')[0];
  return {
    version: 1,
    frame: data.map_frame ?? paths?.map_frame ?? 'world',
    start: startNode ? [startNode.x, startNode.y] : null,
    goal,
    junctions: junctions.map((j) => ({
      id: j.id ?? null,
      at: [j.x, j.y],
      branches: branchEntries(j).length,
      first_by: Array.isArray(j.visited_by) ? j.visited_by[0] ?? null : (j.found_by ?? null),
    })),
    dead_ends: uniqueByDistance([
      ...ofKind('DEAD_END').map((j) => ({ junction: j.id ?? null, at: [j.x, j.y], by: j.found_by ?? null })),
      ...valid.flatMap(deadEndsOf),
    ]),
    corners: ofKind('CORNER').map((j) => [j.x, j.y]),
    open_stubs: junctions.flatMap(openStubsOf),
    paths: paths?.robots ?? {},
    robots,
  };
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < (points?.length ?? 0); i += 1) {
    const [a, b] = [points[i - 1], points[i]];
    if (a && b) total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}
