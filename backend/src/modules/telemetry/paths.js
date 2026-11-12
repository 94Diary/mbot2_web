const MAX_POINTS_PER_ROBOT = 1500;
const MIN_STEP_M = 0.02;

export class RobotPaths {
  runId = null;
  frame = null;
  tracks = new Map();

  update(state) {
    const runId = state.run_id ?? null;
    if (runId !== this.runId) {
      this.runId = runId;
      this.tracks.clear();
    }
    this.frame = state.map_frame ?? null;
    const robots = state.robots ?? {};
    for (const [name, track] of this.tracks) {
      if (!Object.hasOwn(robots, name)) track.interrupted = true;
    }
    for (const [name, pose] of Object.entries(robots)) {
      if (!Number.isFinite(pose?.x) || !Number.isFinite(pose?.y)) continue;
      let track = this.tracks.get(name);
      if (!track) {
        track = { points: [], interrupted: false };
        this.tracks.set(name, track);
      }
      const last = track.points.at(-1);
      if (!track.interrupted && last && Math.hypot(pose.x - last[0], pose.y - last[1]) < MIN_STEP_M) continue;
      if (track.interrupted) track.points.push(null);
      track.points.push([pose.x, pose.y]);
      if (track.points.length > MAX_POINTS_PER_ROBOT) {
        track.points.splice(0, track.points.length - MAX_POINTS_PER_ROBOT);
      }
      track.interrupted = false;
    }
  }

  read(robot = null) {
    const entries = [...this.tracks].filter(([name]) => robot === null || name === robot);
    return {
      run_id: this.runId,
      map_frame: this.frame,
      robots: Object.fromEntries(entries.map(([name, track]) => [name, track.points])),
    };
  }
}
