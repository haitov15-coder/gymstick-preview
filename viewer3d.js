// The 3D viewer of the Gymstick Original for the second design: the stick modelled from the supplier's
// photographs, turned by a drag, taken apart by the slider, with a numbered spot on every part that the list
// beside it explains. Its colour follows the kit chosen on the page. A classic script (three.js comes from
// vendor/three.classic.js), so it also runs when the page is opened as a file. Without WebGL nothing here
// runs and the page keeps the photograph in .viewer__fallback.
(function () {
const THREE = window.THREE;
if (!THREE) return;

const root = document.querySelector('[data-viewer]');
if (!root) return;
const view = root.querySelector('.viewer__view');
const canvas = root.querySelector('.viewer__canvas');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// the five levels: the colours of the stick's ends, its foam grip and its bands, read off the product shots
const LEVELS = {
  light: { name: 'Light', kg: '1 עד 10 ק״ג', rod: 0x3fae40, foam: 0x46b648, band: 0x38a03a },
  medium: { name: 'Medium', kg: '1 עד 15 ק״ג', rod: 0x1f4fc0, foam: 0x2a62d6, band: 0x1a4eb2 },
  strong: { name: 'Strong', kg: '1 עד 20 ק״ג', rod: 0xc9cdd1, foam: 0x1f1e1d, band: 0x1f1e1d },
  extra: { name: 'Extra Strong', kg: '1 עד 25 ק״ג', rod: 0xc9cdd1, foam: 0x9ea2a8, band: 0x9a9ea4 },
  super: { name: 'Super Strong', kg: '1 עד 30 ק״ג', rod: 0xc9cdd1, foam: 0xb99547, band: 0xb08c3e },
};

// each feature: the parts it lights, how far apart the stick must be to show it, and where the camera goes
const FEATS = {
  foam: { parts: ['foam'], minE: 0, cam: { dist: 118, yaw: -0.5, pitch: 0.26 }, at: ['foam', 0, 0, 0], spot: ['foam', 24, 3.1, 0] },
  stick: { parts: ['stickL', 'stickR', 'lock'], minE: 0.55, cam: { dist: 168, yaw: -0.2, pitch: 0.14 }, at: ['stickR', -8, 0, 0], spot: ['stickR', 48, 1.9, 0] },
  lock: { parts: ['lock'], minE: 0.8, cam: { dist: 46, yaw: -0.6, pitch: 0.34 }, at: ['lock', -3.5, 0.4, 0], spot: ['lock', -3.5, 2, 0] },
  strap: { parts: ['strapL', 'strapR'], minE: 0, cam: { dist: 64, yaw: 0.55, pitch: 0.2 }, at: ['strapR', 62, 3.5, 0], spot: ['strapR', 62, 10.4, 0] },
  tube: { parts: ['tubeL', 'tubeR'], minE: 0, cam: { dist: 104, yaw: 0.34, pitch: 0.1 }, at: ['tubeR', 44, -15, 1], spot: ['tubeR', 55, -12.5, 1.5] },
  loop: { parts: ['loopL', 'loopR'], minE: 0, cam: { dist: 66, yaw: 0.24, pitch: 0.3 }, at: ['loopR', 19, -25, 1.5], spot: ['loopR', 20, -21.6, 1.5] },
};

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  renderer = null;
}

if (renderer) start();

function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1.6, 1, 1200);

  // studio light: a soft sky, a key from the upper right that throws the floor shadow, a fill from the left
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfcbc4, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(46, 120, 80);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -110, right: 110, top: 80, bottom: -80, near: 10, far: 400 });
  key.shadow.radius = 6;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(-80, 20, 60);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -54;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- materials (one set a part group, so a group can fade on its own) ----
  const mats = [];
  const mat = (group, role, opts) => {
    const m = new THREE.MeshPhysicalMaterial({ transparent: true, ...opts });
    mats.push({ m, group, role });
    return m;
  };
  const rodMat = (g) => mat(g, 'rod', { color: LEVELS.medium.rod, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const foamMat = (g) => mat(g, 'foam', { color: LEVELS.medium.foam, roughness: 0.96 });
  const bandMat = (g) => mat(g, 'band', { color: LEVELS.medium.band, roughness: 0.34, clearcoat: 0.35 });
  const webMat = (g) => mat(g, 'band', { color: LEVELS.medium.band, roughness: 0.9 });
  const darkMat = (g) => mat(g, 'dark', { color: 0x1b1a19, roughness: 0.55 });
  const redMat = (g) => mat(g, 'red', { color: 0xea0029, roughness: 0.5 });

  // ---- geometry helpers ----
  const model = new THREE.Group();
  scene.add(model);
  const groups = {};
  const group = (name, ex, ey) => {
    const g = new THREE.Group();
    g.userData.explode = new THREE.Vector3(ex, ey, 0);
    groups[name] = g;
    model.add(g);
    return g;
  };
  const add = (g, geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  // a cylinder lying along the stick (the x axis)
  const bar = (r, len, seg = 40) => new THREE.CylinderGeometry(r, r, len, seg, 1).rotateZ(Math.PI / 2);
  // a loop of webbing: a rounded ring w by h, the strap `t` thick and `d` wide, facing the viewer
  const webLoop = (w, h, t, d) => {
    const rr = (s, ww, hh, r) => {
      const x = -ww / 2, y = -hh / 2;
      s.moveTo(x + r, y); s.lineTo(x + ww - r, y); s.absarc(x + ww - r, y + r, r, -Math.PI / 2, 0, false);
      s.lineTo(x + ww, y + hh - r); s.absarc(x + ww - r, y + hh - r, r, 0, Math.PI / 2, false);
      s.lineTo(x + r, y + hh); s.absarc(x + r, y + hh - r, r, Math.PI / 2, Math.PI, false);
      s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    };
    const shape = new THREE.Shape();
    rr(shape, w, h, Math.min(w, h) / 2);
    const hole = new THREE.Path();
    rr(hole, w - 2 * t, h - 2 * t, Math.max(0.2, Math.min(w, h) / 2 - t));
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 20 }).translate(0, 0, -d / 2);
  };

  // ---- the stick: two halves, the right one carrying the pin that locks into the left ----
  const stickL = group('stickL', -8, 0);
  add(stickL, bar(1.7, 65), rodMat('stickL'), -32.5);
  add(stickL, bar(2, 2.6), darkMat('stickL'), -64.6);
  const stickR = group('stickR', 8, 0);
  add(stickR, bar(1.7, 65), rodMat('stickR'), 32.5);
  add(stickR, bar(2, 2.6), darkMat('stickR'), 64.6);
  const lock = group('lock', 8, 0);
  add(lock, bar(1.15, 7.6, 28), darkMat('lock'), -3.6);
  add(lock, new THREE.SphereGeometry(0.62, 20, 14), redMat('lock'), -3.5, 1.02, 0);

  // ---- the foam grip, with the address printed along it as on the product ----
  const foam = group('foam', 0, 15);
  add(foam, new THREE.CapsuleGeometry(2.9, 68, 10, 44).rotateZ(Math.PI / 2), foamMat('foam'));
  const label = document.createElement('canvas');
  label.width = 1024; label.height = 64;
  const lc = label.getContext('2d');
  lc.fillStyle = '#fff';
  lc.font = '700 40px Assistant, Arial, sans-serif';
  lc.textAlign = 'center'; lc.textBaseline = 'middle';
  if ('letterSpacing' in lc) lc.letterSpacing = '6px';
  lc.fillText('WWW.GYMSTICK.COM', 512, 34);
  const labelTex = new THREE.CanvasTexture(label);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = 8;
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false });
  mats.push({ m: labelMat, group: 'foam', role: 'label' });
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(33, 2.06), labelMat);
  labelMesh.position.set(0, 0, 2.93);
  foam.add(labelMesh);

  // ---- the fastening straps at the ends ----
  for (const [name, x, ex] of [['strapL', -62, -13], ['strapR', 62, 13]]) {
    const g = group(name, ex, 9);
    add(g, webLoop(4.6, 13, 0.55, 3.2), webMat(name), x, 4.2, 0);
    add(g, new THREE.BoxGeometry(0.62, 3.2, 3.26), redMat(name), x + (x < 0 ? -2.32 : 2.32), 7, 0);
  }

  // ---- the two resistance bands, hanging from the ends to the foot loops ----
  for (const [name, sx, ex] of [['tubeL', -1, -10], ['tubeR', 1, 10]]) {
    const g = group(name, ex, -9);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(63 * sx, -1.8, 0), new THREE.Vector3(62 * sx, -8, 0.6), new THREE.Vector3(55 * sx, -17, 1.2),
      new THREE.Vector3(40 * sx, -23, 1.5), new THREE.Vector3(22 * sx, -25.4, 1.5), new THREE.Vector3(8.5 * sx, -25, 1.5),
    ]);
    add(g, new THREE.TubeGeometry(curve, 90, 0.74, 16), bandMat(name));
    add(g, new THREE.SphereGeometry(1.2, 16, 12), darkMat(name), 63 * sx, -1.8, 0);
  }

  // ---- the foot loops, each with its buckle and the red label ----
  for (const [name, sx, ex] of [['loopL', -1, -14], ['loopR', 1, 14]]) {
    const g = group(name, ex, -22);
    add(g, webLoop(24, 5.8, 0.58, 3.2), webMat(name), 20 * sx, -25, 1.5);
    add(g, new THREE.BoxGeometry(3.6, 4.6, 3.7), darkMat(name), 7.6 * sx, -25, 1.5);
    add(g, new THREE.BoxGeometry(6, 0.64, 3.28), redMat(name), 22 * sx, -22.12, 1.5);
  }

  // ---- state ----
  const state = {
    e: still ? 1 : 0, eGoal: still ? 1 : 0, eManual: false,
    yaw: -0.42, pitch: 0.16, yawGoal: -0.42, pitchGoal: 0.16,
    dist: 300, distGoal: 300, target: new THREE.Vector3(0, -12, 0), targetGoal: new THREE.Vector3(0, -12, 0),
    feat: null, touched: false, visible: false, w: 0, h: 0,
  };
  let homeYaw = -0.42;
  const dim = Object.fromEntries(Object.keys(groups).map((k) => [k, 1]));
  const tmp = new THREE.Vector3();

  const worldOf = ([g, x, y, z], out) => out.set(x, y, z).addScaledVector(groups[g].userData.explode, state.e);
  const overview = () => {
    // fit the whole stick, apart or together, into the frame
    const e = state.eGoal;
    // a narrow screen looks along the stick, so its length is foreshortened and the parts read larger
    const yaw = camera.aspect < 1.3 ? -0.98 : -0.42;
    if (!state.touched || !state.feat) homeYaw = yaw;
    const halfW = (72 + 15 * e) * Math.cos(yaw) + (camera.aspect < 1.3 ? 26 : 10), halfH = 24 + 17 * e;
    const t = Math.tan((camera.fov * Math.PI) / 360);
    state.distGoal = Math.max(halfH / t, halfW / (t * camera.aspect)) * 1.03;
    state.targetGoal.set(0, -10 - 5 * e, 0);
  };

  const feats = [...root.querySelectorAll('.viewer__feat')];
  const spots = [...root.querySelectorAll('.viewer__spot')];
  const slider = root.querySelector('[data-viewer-explode]');
  const reset = root.querySelector('[data-viewer-reset]');

  const select = (id) => {
    state.feat = id && id !== state.feat ? id : null;
    state.touched = true;
    root.classList.add('is-touched');
    feats.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.feat === state.feat)));
    spots.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.feat === state.feat)));
    reset.hidden = !state.feat;
    if (state.feat) {
      const f = FEATS[state.feat];
      if (state.eGoal < f.minE) { state.eGoal = f.minE; state.eManual = true; slider.value = Math.round(f.minE * 100); }
      const narrow = camera.aspect < 1 ? 1.45 : 1;
      state.distGoal = f.cam.dist * narrow;
      state.yawGoal = f.cam.yaw; state.pitchGoal = f.cam.pitch;
    } else {
      overview();
      state.yawGoal = homeYaw; state.pitchGoal = camera.aspect < 1.3 ? 0.24 : 0.16;
    }
  };
  feats.forEach((b) => b.addEventListener('click', () => select(b.dataset.feat)));
  spots.forEach((b) => b.addEventListener('click', () => select(b.dataset.feat)));
  reset.addEventListener('click', () => select(null));

  slider.addEventListener('input', () => {
    state.eManual = true;
    state.eGoal = slider.value / 100;
    if (!state.feat) overview();
  });

  // ---- the level: recolour the model, tell the order form ----
  const levelLine = root.querySelector('[data-viewer-level]');
  const colourGoal = { rod: new THREE.Color(), foam: new THREE.Color(), band: new THREE.Color() };
  const setLevel = (id, fromOrder) => {
    const L = LEVELS[id];
    if (!L) return;
    colourGoal.rod.setHex(L.rod); colourGoal.foam.setHex(L.foam); colourGoal.band.setHex(L.band);
    levelLine.textContent = `\u2068${L.name}\u2069, ${L.kg}`;
    const mine = root.querySelector(`input[name="viewer-level"][value="${id}"]`);
    if (mine) mine.checked = true;
    if (!fromOrder) {
      const theirs = document.querySelector(`input[name="kit"][value="${id}"], input[name="level"][value="${id}"]`);
      if (theirs && !theirs.checked) { theirs.checked = true; theirs.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  };
  root.querySelectorAll('input[name="viewer-level"]').forEach((i) => i.addEventListener('change', () => setLevel(i.value)));
  const pageChoice = 'input[name="kit"], input[name="level"]';
  document.querySelectorAll(pageChoice).forEach((i) => i.addEventListener('change', () => i.checked && setLevel(i.value, true)));
  const chosen = [...document.querySelectorAll(pageChoice)].find((i) => i.checked);
  setLevel(chosen && LEVELS[chosen.value] ? chosen.value : 'medium', true);
  mats.forEach(({ m, role }) => colourGoal[role] && m.color.copy(colourGoal[role]));

  // ---- turning it: a drag, or the arrow keys ----
  let drag = null;
  canvas.addEventListener('pointerdown', (ev) => {
    drag = { x: ev.clientX, y: ev.clientY };
    canvas.setPointerCapture(ev.pointerId);
    canvas.classList.add('is-dragging');
    state.touched = true;
    root.classList.add('is-touched');
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    state.yawGoal -= (ev.clientX - drag.x) * 0.0085;
    state.pitchGoal = Math.min(1.1, Math.max(-0.35, state.pitchGoal + (ev.clientY - drag.y) * 0.006));
    drag = { x: ev.clientX, y: ev.clientY };
  });
  const endDrag = () => { drag = null; canvas.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', (ev) => {
    const step = { ArrowLeft: [0.18, 0], ArrowRight: [-0.18, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[ev.key];
    if (!step) return;
    ev.preventDefault();
    state.touched = true;
    root.classList.add('is-touched');
    state.yawGoal += step[0];
    state.pitchGoal = Math.min(1.1, Math.max(-0.35, state.pitchGoal + step[1]));
  });

  // ---- size ----
  const resize = () => {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h || (w === state.w && h === state.h)) return;
    state.w = w; state.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!state.feat) overview();
  };
  new ResizeObserver(resize).observe(view);

  // ---- the frame ----
  const clock = new THREE.Clock();
  const frame = () => {
    requestAnimationFrame(frame);
    if (!state.visible) return;
    const dt = Math.min(0.05, clock.getDelta());
    const k = still ? 1 : 1 - Math.exp(-dt * 6);

    // until the visitor takes the slider, the stick comes apart as its section scrolls in
    if (!state.eManual && !still) {
      const top = view.getBoundingClientRect().top;
      state.eGoal = Math.min(1, Math.max(0, (innerHeight * 0.82 - top) / (innerHeight * 0.5)));
      slider.value = Math.round(state.eGoal * 100);
      if (!state.feat) overview();
    }
    state.e += (state.eGoal - state.e) * k;
    const ease = state.e * state.e * (3 - 2 * state.e);
    for (const g of Object.values(groups)) g.position.copy(g.userData.explode).multiplyScalar(ease);

    // a slow sway until it is touched
    if (!state.touched && !still) state.yawGoal = homeYaw + Math.sin(clock.elapsedTime * 0.45) * 0.2;
    else if (!state.touched) state.yawGoal = homeYaw;
    if (state.feat) worldOf(FEATS[state.feat].at, state.targetGoal);
    state.yaw += (state.yawGoal - state.yaw) * k;
    state.pitch += (state.pitchGoal - state.pitch) * k;
    state.dist += (state.distGoal - state.dist) * k;
    state.target.lerp(state.targetGoal, k);
    const cp = Math.cos(state.pitch);
    camera.position.set(state.target.x + state.dist * Math.sin(state.yaw) * cp, state.target.y + state.dist * Math.sin(state.pitch), state.target.z + state.dist * Math.cos(state.yaw) * cp);
    camera.lookAt(state.target);

    // the chosen part stays solid, the rest steps back; colours ease to the chosen level
    const lit = state.feat ? FEATS[state.feat].parts : null;
    for (const name of Object.keys(dim)) dim[name] += ((lit && !lit.includes(name) ? 0.14 : 1) - dim[name]) * k;
    for (const { m, group: g, role } of mats) {
      m.opacity = dim[g];
      m.depthWrite = dim[g] > 0.6 && role !== 'label';
      if (colourGoal[role]) m.color.lerp(colourGoal[role], k);
    }

    renderer.render(scene, camera);

    // the numbered spots follow their parts
    for (const b of spots) {
      worldOf(FEATS[b.dataset.feat].spot, tmp).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * state.w, y = (-tmp.y * 0.5 + 0.5) * state.h;
      const off = tmp.z > 1 || x < 10 || x > state.w - 10 || y < 10 || y > state.h - 10;
      const needs = FEATS[b.dataset.feat].minE > 0 && state.e < 0.35 && state.feat !== b.dataset.feat;
      b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      b.style.opacity = off ? 0 : needs ? 0.45 : 1;
      b.style.pointerEvents = off ? 'none' : '';
    }
  };

  new IntersectionObserver((entries) => { state.visible = entries[0].isIntersecting; }, { rootMargin: '200px 0px' }).observe(view);
  root.classList.add('is-3d');
  resize();
  overview();
  state.dist = state.distGoal;
  state.target.copy(state.targetGoal);
  requestAnimationFrame(frame);
}
})();
