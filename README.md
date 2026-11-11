# mBot2 Mission Monitor

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full mBot2 → ROS 2 → web flow,
tool list, topic map and current-vs-future scope.

This project has a **JavaScript backend** in Ubuntu WSL
(`~/mBot2_web/backend`, Express + rclnodejs) and a React frontend on Windows
(`C:\Users\knkzu\Desktop\mBot2_web\frontend`, Vite). The backend reads ROS 2
Humble topics in Ubuntu 22.04 / WSL and sends telemetry to the browser. It cannot send motor
commands; there is no `/cmd_vel` publisher or control API.

## Data flow

`Gazebo / maze_solver → ROS 2 topics → rclnodejs → Express + WebSocket → React`

The backend subscribes to `/maze_team/state`, `/maze_team/report`,
`/maze_team/decision`, and `/mbot1/trail` through `/mbot3/trail`. Team state
contains robot positions, discovered junctions and a shared goal. Recent events
are kept in memory only (up to 500), so restarting the backend clears them.

## What teammates need

- Ubuntu 22.04 / WSL with ROS 2 Humble and the built `~/ros2_ws` workspace.
- Node.js 24 LTS **inside Ubuntu** for `~/mBot2_web/backend`; the Windows Node.js binary
  cannot load ROS 2's Linux native libraries. On this computer it is installed
  at `/home/knkzu/.local/node-v24.21.0-linux-x64`.
- Node.js with npm on Windows for `frontend/` (already installed here).
- VS Code is just the editor. Open the backend using VS Code's WSL connection
  and the frontend folder from Windows, or use separate Ubuntu/PowerShell terminals.

The JavaScript packages are `express`, `rclnodejs`, `ws`, `react`, `react-dom`,
`vite`, and `@vitejs/plugin-react`. The frontend uses built-in `fetch` and
`WebSocket`; Axios is not installed. Python is **not** needed for this web app,
although Gazebo and the existing robot ROS nodes still use Python.

## Start the backend (Ubuntu terminal in VS Code)

Copy `backend/.env.example` to `backend/.env` once. Generate a token with
`node -p "require('node:crypto').randomBytes(32).toString('hex')"` and paste it
into `MBOT2_API_TOKEN` in that file. Git ignores `.env`. The backend starts
only with a valid token and binds to a loopback address.

```bash
cd ~/mBot2_web/backend
export PATH=/home/knkzu/.local/node-v24.21.0-linux-x64/bin:$PATH
source /opt/ros/humble/setup.bash
source ~/ros2_ws/install/setup.bash
npm ci                 # once, or after package-lock.json changes
npm start
```

Keep this terminal open. Check `GET http://localhost:8000/api/health` with
the `Authorization: Bearer <token>` header. If
`ros_node_running` is false, inspect `ros_error` and confirm ROS was sourced.

## Start the frontend (VS Code PowerShell terminal)

```powershell
cd C:\Users\knkzu\Desktop\mBot2_web\frontend
npm ci                 # once, or after package-lock.json changes
npm run dev
```

Open `http://localhost:5173`. Start Gazebo / the multi-robot launch in another
Ubuntu terminal. The page can open without Gazebo but will say it is waiting
for ROS 2 until `/maze_team/state` arrives. Vite proxies `/api` and `/ws` to
the Express backend on port 8000.

The current frontend still needs to pass the telemetry token before it can read
the secured API. HTTP clients use the Bearer header. Browser WebSocket clients
offer the protocols `mbot2.telemetry.v1` and `mbot2.token.<token>`. The server
selects only `mbot2.telemetry.v1`. Keep the token out of frontend source code
and URLs.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Backend/ROS status and age of the latest team state |
| `GET /api/team` | Latest team snapshot: robots, junctions, goal |
| `GET /api/events?limit=50&after_id=0` | Recent report, decision and trail events |
| `WS /ws/telemetry` | Snapshot every 0.5 seconds |

If `/api/team` has `received_at: null`, check
`ros2 topic echo /maze_team/state` in Ubuntu. The JavaScript API can be tested
without Gazebo using `cd backend && npm test` (five API/store tests).

## Constraints

- One local backend process. Data is kept in memory, not in a database.
- Backend binds to `127.0.0.1`; do not expose it publicly without adding
  authentication and HTTPS.
- Physical mBot2 robots will need ROS 2 drivers and localization to produce
  the same shared topics; Gazebo's ground-truth coordinates do not exist on
  the physical robot.
# mbot2_web
# mbot2_web
