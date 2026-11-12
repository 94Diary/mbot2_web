import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PARTS, groupOf } from './parts.js';

const MODEL_URL = '/models/mbot2.glb';
const FALLBACK_URL = '/models/mbot2-front34.png';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// ปรับวัสดุจาก Blender ให้ดูดีในเว็บ: กระจกใส, โลหะไม่ดำ (เหมือนตัวดูในดีไซน์)
function tuneMaterial(m) {
  const name = (m.name || '').toLowerCase();
  if (m.transmission > 0) {
    m.transmission = 0;
    m.transparent = true;
    m.opacity = name.includes('dark') ? 0.42 : 0.16;
    m.roughness = 0.1;
    m.metalness = 0;
  }
  m.envMapIntensity = (m.metalness || 0) > 0.3 ? 0.8 : 0.3;
  if (name.includes('anodized')) { m.metalness = 0.6; m.roughness = 0.3; m.envMapIntensity = 0.9; }
  m.needsUpdate = true;
}

/**
 * 3D mBot2 (three.js, loaded lazily). `interactive`: click a part → it lifts out, the rest fade, the camera
 * moves to it and `onSelect(key)` fires (same behaviour as the design's viewer). `explodeAll` spreads every part.
 * Falls back to a still render when WebGL or the model is unavailable, so the page never breaks.
 */
export function RobotViewer({
  interactive = false, autoRotate = true, selected = null, onSelect, height = 420, label = 'โมเดล 3D ของหุ่น mBot2',
  hotspots = [], explodeAll = false, viewResetKey = 0,
}) {
  const hsRefs = useRef({});
  const mount = useRef(null);
  const api = useRef(null);
  const [state, setState] = useState(() => (webglAvailable() ? 'loading' : 'fallback'));
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (state === 'fallback') return undefined;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      if (disposed || !mount.current) return;
      const el = mount.current;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.8;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      el.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-label', label);
      renderer.domElement.setAttribute('role', 'img');

      // แสงนุ่ม ๆ ไม่จ้า: แสงรอบตัวจากห้องจำลอง + ไฟหลัก/ไฟขอบอ่อน ๆ
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.45;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x404552, 0.4));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(30, 60, 40);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffc49a, 0.6);
      rim.position.set(-40, 25, -35);
      scene.add(rim);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 2000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 0.6;
      controls.enablePan = false;
      controls.enableZoom = interactive;

      let gltf;
      try {
        gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      } catch {
        renderer.dispose();
        el.innerHTML = '';
        if (!disposed) setState('fallback');
        return;
      }
      if (disposed) { renderer.dispose(); return; }
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      const minY = box.min.y;
      model.position.sub(centre);
      scene.add(model);
      model.updateMatrixWorld(true);

      // เงาบนพื้นใต้หุ่น
      const shadowMat = new THREE.ShadowMaterial({ opacity: 0.28, depthWrite: false });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(size * 4, size * 4), shadowMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = minY - centre.y - 0.01;
      ground.receiveShadow = true;
      ground.renderOrder = -1;
      scene.add(ground);
      Object.assign(key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, far: size * 8 });

      // ทุก mesh อยู่ในกลุ่มใดกลุ่มหนึ่งเสมอ · ทิศแยกชิ้น (explode) และทิศยกชิ้นที่ถูกเลือก (lift) ตามดีไซน์
      const V = (x, y, z) => new THREE.Vector3(x, y, z);
      const EXPLODE_DIR = { ultrasonic: V(1, 0.25, 0), quadrgb: V(1, -0.08, 0), cyberpi: V(0, 1, 0), imu: V(0, 1.9, 0), body: V(0, 0, 0) };
      const LIFT_DIR = { ultrasonic: V(1, 0.12, 0), quadrgb: V(1.15, -0.05, 0), cyberpi: V(0, 1, 0), imu: V(0, 1.5, 0), body: V(0, 1, 0) };
      const tuned = new Set();
      const meshes = [];
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        if (!tuned.has(o.material.uuid)) { tuneMaterial(o.material); tuned.add(o.material.uuid); }
        o.material = o.material.clone();
        let g = groupOf(o.name);
        if (g === 'body' && o.parent && o.parent !== model) g = groupOf(o.parent.name);
        const wp = o.getWorldPosition(new THREE.Vector3());
        const side = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).z >= 0 ? 1 : -1;
        let ex = g === 'wheels' ? V(0, 0, side) : EXPLODE_DIR[g].clone();
        let lift = (g === 'wheels' ? V(0, 0.08, side) : LIFT_DIR[g].clone()).normalize();
        let amt = g === 'body' ? 0.12 : 0.2;
        let exAmt = 0.22;
        // ล้อหน้า (ลูกบอล) ลอยลงออกจากใต้ท้องรถ
        if (/^Caster/.test(o.name) || (o.parent && /^Caster/.test(o.parent.name))) { lift = V(0.1, -1, 0).normalize(); amt = 0.32; ex = V(0, -1, 0); exAmt = 0.08; }
        const toLocal = (v) => o.parent.worldToLocal(wp.clone().add(v)).sub(o.parent.worldToLocal(wp.clone()));
        const opacity = o.material.transparent ? o.material.opacity : 1;
        o.userData = {
          group: g, base: o.position.clone(), side,
          explodeDir: toLocal(ex.multiplyScalar(size * exAmt)),
          liftDir: toLocal(lift.multiplyScalar(size * amt)),
          baseEmissive: o.material.emissive ? o.material.emissive.clone() : null,
          baseIntensity: o.material.emissiveIntensity ?? 1,
          baseOpacity: opacity, goalPos: o.position.clone(), goalOpacity: opacity,
        };
        o.material.transparent = true;
        meshes.push(o);
      });

      // จุดกึ่งกลางของแต่ละชิ้น (ตอนประกอบ) ไว้วางป้าย hotspot · ล้อใช้ฝั่งขวา ไม่งั้นป้ายไปอยู่กลางตัวหุ่น
      const centres = new Map();
      for (const part of PARTS) {
        const b = new THREE.Box3();
        for (const m of meshes) if (m.userData.group === part.key && (part.key !== 'wheels' || m.userData.side === 1)) b.expandByObject(m);
        if (!b.isEmpty()) centres.set(part.key, model.worldToLocal(b.getCenter(new THREE.Vector3())));
      }

      const homeView = { pos: V(size * 1.2, size * 0.75, size * 1.05), target: V(0, 0, 0) };
      camera.position.copy(homeView.pos);
      controls.target.copy(homeView.target);
      controls.minDistance = size * 0.25;
      controls.maxDistance = size * 3.5;

      const st = { pick: null, exploded: false, camGoal: null };
      const applyTargets = (moveCam) => {
        const focus = new THREE.Box3();
        for (const m of meshes) {
          const u = m.userData;
          const on = st.pick !== null && u.group === st.pick;
          const goal = u.base.clone();
          if (st.exploded) goal.add(u.explodeDir);
          if (on) goal.add(u.liftDir);
          u.goalPos = goal;
          u.goalOpacity = st.pick === null || on ? u.baseOpacity : 0.1;
          if (m.material.emissive) {
            if (on) { m.material.emissive.setHex(0xff6b1a); m.material.emissiveIntensity = 0.28; }
            else if (u.baseEmissive) { m.material.emissive.copy(u.baseEmissive); m.material.emissiveIntensity = u.baseIntensity; }
          }
          if (on) {
            const saved = m.position.clone();
            m.position.copy(goal); m.updateMatrixWorld(true);
            focus.expandByObject(m);
            m.position.copy(saved); m.updateMatrixWorld(true);
          }
        }
        if (!moveCam) return;
        controls.autoRotate = false;
        const dir = camera.position.clone().sub(controls.target).normalize();
        if (!focus.isEmpty()) {
          const c = focus.getCenter(new THREE.Vector3());
          const span = Math.max(focus.getSize(new THREE.Vector3()).length(), size * 0.2);
          st.camGoal = { target: c, pos: c.clone().add(dir.multiplyScalar(span * 2.6)) };
        } else {
          st.camGoal = { target: homeView.target.clone(), pos: homeView.target.clone().add(dir.multiplyScalar(homeView.pos.length())) };
        }
      };
      let lastPick;
      let lastEx;
      api.current = {
        select: (keyName, all) => { st.pick = keyName ?? null; st.exploded = Boolean(all); },
        reset: () => { st.camGoal = { target: homeView.target.clone(), pos: homeView.pos.clone() }; controls.autoRotate = autoRotate; },
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const hit = (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        // ชิ้นที่จางอยู่ (ไม่ได้เลือก) กดทะลุไปหาชิ้นข้างหลังได้
        return raycaster.intersectObjects(meshes, false).find((h) => h.object.material.opacity > 0.2)?.object.userData.group ?? null;
      };
      let downAt = null;
      const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
      const onUp = (e) => {
        if (!interactive || !downAt) return;
        const moved = Math.abs(e.clientX - downAt[0]) + Math.abs(e.clientY - downAt[1]);
        downAt = null;
        if (moved > 5) return;
        const g = hit(e);
        onSelectRef.current?.(g === null || g === st.pick ? null : g);
      };
      const onMove = (e) => { if (interactive && !downAt) renderer.domElement.style.cursor = hit(e) !== null ? 'pointer' : 'grab'; };
      const onStart = () => { controls.autoRotate = false; st.camGoal = null; };
      controls.addEventListener('start', onStart);
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointerup', onUp);
      renderer.domElement.addEventListener('pointermove', onMove);

      const resize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(el);
      resize();

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) controls.autoRotate = false;
      const k = reduced ? 1 : 0.09;
      let frame;
      const tick = () => {
        if (st.pick !== lastPick || st.exploded !== lastEx) {
          applyTargets(lastPick !== undefined && st.pick !== lastPick);
          lastPick = st.pick;
          lastEx = st.exploded;
        }
        for (const m of meshes) {
          const u = m.userData;
          m.position.lerp(u.goalPos, k);
          m.material.opacity += (u.goalOpacity - m.material.opacity) * k;
          m.material.depthWrite = m.material.opacity > 0.6;
        }
        if (st.camGoal) {
          controls.target.lerp(st.camGoal.target, k * 0.8);
          camera.position.lerp(st.camGoal.pos, k * 0.8);
          if (camera.position.distanceTo(st.camGoal.pos) < size * 0.002) st.camGoal = null;
        }
        controls.update();
        renderer.render(scene, camera);
        const rect = renderer.domElement.getBoundingClientRect();
        for (const [partKey, node] of Object.entries(hsRefs.current)) {
          const c = centres.get(partKey);
          if (!node || !c) continue;
          const p = model.localToWorld(c.clone()).project(camera);
          node.style.left = `${((p.x + 1) / 2) * rect.width}px`;
          node.style.top = `${((1 - p.y) / 2) * rect.height}px`;
          node.dataset.side = p.x < 0 ? 'left' : 'right';
          node.style.opacity = p.z < 1 ? '1' : '0';
        }
        frame = requestAnimationFrame(tick);
      };
      tick();
      setState('ready');

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.removeEventListener('start', onStart);
        controls.dispose();
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointerup', onUp);
        renderer.domElement.removeEventListener('pointermove', onMove);
        model.traverse((obj) => { if (obj.isMesh) { obj.geometry.dispose(); obj.material.dispose(); } });
        ground.geometry.dispose();
        shadowMat.dispose();
        scene.environment?.dispose();
        pmrem.dispose();
        renderer.dispose();
        el.innerHTML = '';
        api.current = null;
      };
    })().catch(() => { if (!disposed) setState('fallback'); });
    return () => { disposed = true; cleanup(); };
  }, [interactive, autoRotate, label]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { api.current?.select(selected, explodeAll); }, [selected, explodeAll, state]);
  useEffect(() => { if (viewResetKey) api.current?.reset(); }, [viewResetKey]);

  if (state === 'fallback') {
    return <img src={FALLBACK_URL} alt={label} style={{ width: '100%', maxWidth: 560, height: 'auto', display: 'block', margin: '0 auto' }} />;
  }
  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      <div ref={mount} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />
      {state === 'ready' ? hotspots.map((h) => (
        <Link key={h.key} to={h.to} className="hs hs3d" ref={(el) => { hsRefs.current[h.key] = el; }} aria-label={`ดู${h.label}ในหน้ารู้จักหุ่น`}>
          <span className="hs-line" /><span className="hs-dot" /><span className="hs-lab">{h.label}</span>
        </Link>
      )) : null}
      {state === 'loading' ? <div className="skel" style={{ position: 'absolute', inset: 0, borderRadius: 28 }} aria-label="กำลังโหลดโมเดล 3D" /> : null}
    </div>
  );
}
