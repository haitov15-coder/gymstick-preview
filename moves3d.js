// The exercise demonstrations in 3D for the second design: a jointed training figure performs nine movements
// with the Gymstick in a loop, and a drag turns it. The poses follow the photographs in the same section.
// Arms and legs are solved from where the hands and feet must be, so the hands stay on the stick or on the
// bands' loops, and the feet where the movement puts them. A classic script (three.js comes from
// vendor/three.classic.js), so it also runs when the page is opened as a file. Without WebGL nothing here
// runs and the block stays hidden, leaving the photographs on their own.
(function () {
const THREE = window.THREE;
if (!THREE) return;

const root = document.querySelector('[data-moves3d]');
if (!root) return;
const stage = root.querySelector('.moves3d__stage');
const canvas = root.querySelector('.moves3d__canvas');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  return;
}
root.hidden = false;

// the colours of the five levels, as in the product viewer
const LEVELS = {
  light: { rod: 0x3fae40, foam: 0x46b648, band: 0x38a03a },
  medium: { rod: 0x1f4fc0, foam: 0x2a62d6, band: 0x1a4eb2 },
  strong: { rod: 0xc9cdd1, foam: 0x1f1e1d, band: 0x1f1e1d },
  extra: { rod: 0xc9cdd1, foam: 0x9ea2a8, band: 0x9a9ea4 },
  super: { rod: 0xc9cdd1, foam: 0xb99547, band: 0xb08c3e },
};

// the figure's measures, in metres (about 1.75 m tall), and the stick's half length
const M = { upperArm: 0.28, forearm: 0.25, thigh: 0.44, shin: 0.42, hip: 0.095, shoulder: 0.185, spine: 0.475, stick: 0.64 };

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const ramp = (a, b, t) => smooth((t - a) / (b - a));

// Each movement: the time of its four parts (going, holding, returning, resting), where the camera stands,
// and the pose at any point u between its start (0) and its end (1). The figure faces +z and its left is +x.
//
// A pose starts from BASE and changes what it needs:
//   the hips (px, py, pz), the forward lean and the turn of the chest, how far the hips (pt) and the head (hp)
//     follow the lean;
//   each foot: the ball's place (x, y, z), its turn, how far the heel is lifted, its sideways roll; how far
//     the knees open (knee) and whether they point down (khl, khr), as they do on all fours;
//   the stick: its place on the chest (sx, sy, sz, syaw, sroll) or in the room (tx, ty, tz, tyaw, troll),
//     and which of the two counts (sw: 0 on the chest, 1 in the room);
//   the hands: where each grips the stick (gl, gr, along its length) and where the wrist sits against it
//     (wy, wz), or a free place in the room for each (hl*, hr*) when they hold the bands' loops instead
//     (hf: 0 on the stick, 1 free); the direction the elbows point (ex, ey, ez);
//   each band's far end (bl, br): 0 at the foot loop, 1 in the hand.
const BASE = {
  px: 0, py: 0.922, pz: 0, lean: 0, twist: 0, pt: 0.45, hp: 0.25,
  lx: 0.17, ly: 0, lz: 0.08, lyaw: 0.14, llift: 0, lroll: 0,
  rx: -0.17, ry: 0, rz: 0.08, ryaw: -0.14, rlift: 0, rroll: 0,
  knee: 0.12, khl: 0, khr: 0,
  sw: 0, sx: 0, sy: 0, sz: 0.2, syaw: 0, sroll: 0, tx: 0, ty: 0.0275, tz: 0, tyaw: 0, troll: 0,
  gl: 0.37, gr: -0.37, wy: -0.05, wz: 0,
  hf: 0, hlx: 0.2, hly: 1.2, hlz: 0.2, hrx: -0.2, hry: 1.2, hrz: 0.2,
  ex: 0.5, ey: -1, ez: 0,
  bl: 0, br: 0,
};
const pose = (changes) => Object.assign({}, BASE, changes);
// feet that stand on the stick lying on the floor are lifted by the thickness of its foam grip
const ON_STICK = 0.045;

const MOVES = {
  squat: {
    time: [1.5, 0.25, 1.2, 0.5],
    cam: { yaw: -0.62, y: 0.84, z: -0.04, half: 1.03 },
    pose: (u) => pose({
      py: lerp(0.925, 0.5, u), pz: lerp(0, -0.27, u), lean: lerp(0.05, 0.5, u),
      lx: 0.2, lz: 0.09, lyaw: 0.21, rx: -0.2, rz: 0.09, ryaw: -0.21, knee: 0.3,
      sy: 0.075, sz: -0.085, gl: 0.37, gr: -0.37, wy: -0.05, wz: 0.025, ex: 0.25, ey: -1, ez: -0.25,
    }),
  },
  press: {
    time: [1.1, 0.3, 1.5, 0.45],
    cam: { yaw: -0.36, y: 1.01, z: 0, half: 1.2 },
    pose: (u) => pose({
      lean: lerp(0.02, -0.02, u),
      // the stick clears the face on its way up, then settles over the shoulders
      sy: lerp(0.04, 0.535, u), sz: 0.15 - 0.13 * ramp(0.55, 1, u), gl: 0.38, gr: -0.38, wy: -0.055, wz: 0,
      ex: lerp(0.5, 1, u), ey: -1, ez: lerp(0.4, 0.1, u),
    }),
  },
  lunge: {
    time: [1.5, 0.35, 1.3, 0.45],
    cam: { yaw: -1.0, y: 0.78, z: -0.08, half: 1.0 },
    pose: (u) => {
      // going down, the trunk turns to the front leg and the left hand (on the back leg's side) pushes the
      // stick forward until that arm is straight, while the right hand draws back to the ribs
      const push = smooth(u);
      return pose({
        py: lerp(0.82, 0.525, u), pz: lerp(-0.12, -0.15, u), lean: lerp(0.06, 0.1, u), twist: -0.6 * push,
        // the right foot in front, flat; the left behind, on its toes
        lx: 0.13, lz: -0.57, lyaw: 0, llift: lerp(0.6, 1.05, u), rx: -0.13, rz: 0.42, ryaw: 0, knee: 0,
        sx: 0.25 * push, sy: lerp(-0.07, -0.16, push), sz: lerp(0.3, 0.22, push), syaw: -0.25 * push, sroll: 0.16 * push,
        gl: 0.375, gr: -0.375, wy: -0.02, wz: -0.055, ex: lerp(1, 0.4, push), ey: lerp(-0.7, -0.3, push), ez: -push,
      });
    },
  },
  // standing curl: the elbows stay by the sides and the forearms swing the stick from the thighs to the chest
  curl: {
    time: [1.2, 0.3, 1.5, 0.45],
    cam: { yaw: -0.5, y: 0.9, z: 0, half: 1.06 },
    pose: (u) => {
      const a = lerp(-1.25, 0.6, u), sin = Math.sin(a), cos = Math.cos(a);   // the forearm's angle about the elbow
      return pose({
        lean: 0.02, lx: 0.14, rx: -0.14,
        sy: -0.275 + 0.3 * sin + 0.035 * cos, sz: -0.01 + 0.3 * cos - 0.035 * sin,
        gl: 0.2, gr: -0.2, wy: -(0.035 * cos + 0.05 * sin), wz: 0.035 * sin - 0.05 * cos,
        ex: 0.15, ey: -0.4, ez: -1,
      });
    },
  },
  // on all fours, the hands on the stick that lies on the floor: one leg lifts back and up against its band
  kick: {
    time: [1.3, 0.35, 1.4, 0.45],
    cam: { yaw: -1.25, y: 0.52, z: -0.28, half: 0.86 },
    pose: (u) => {
      const e = smooth(u);
      const ankleY = lerp(0.2, 1.015, e), ankleZ = lerp(-0.67, -0.862, e), pitch = lerp(1.45, 2.27, e);   // the right foot
      return pose({
        py: 0.5, pz: -0.25, lean: 1.358, pt: 0.95, hp: 0.72,
        lx: 0.095, ly: 0.06, lz: -0.739, lyaw: 0, llift: 1.45,
        rx: -0.095, ry: ankleY - (0.085 * Math.cos(pitch) + 0.13 * Math.sin(pitch)), rz: ankleZ - (0.085 * Math.sin(pitch) - 0.13 * Math.cos(pitch)), ryaw: 0, rlift: pitch,
        knee: 0, khl: -1.5, khr: -1.5,
        sw: 1, tx: 0, ty: 0.0275, tz: 0.234,
        gl: 0.2, gr: -0.2, wy: 0.05, wz: 0, ex: 0.3, ey: -1, ez: 0,
      });
    },
  },
  // standing on the stick, the two loops held together behind the head: the arms straighten upward
  triceps: {
    time: [1.1, 0.3, 1.5, 0.45],
    cam: { yaw: -0.75, y: 1.02, z: 0, half: 1.22 },
    pose: (u) => pose({
      py: 0.922 + ON_STICK, lean: 0.03, lx: 0.15, ly: ON_STICK, rx: -0.15, ry: ON_STICK,
      sw: 1, tz: 0.01,
      hf: 1, hlx: lerp(0.045, 0.06, u), hly: lerp(1.56, 1.94, u), hlz: lerp(-0.17, -0.03, u),
      hrx: -lerp(0.045, 0.06, u), hry: lerp(1.56, 1.94, u), hrz: lerp(-0.17, -0.03, u),
      ex: 0.35, ey: 1, ez: 0.6, bl: 1, br: 1,
    }),
  },
  // standing on one leg, the stick held as a staff: the other leg lifts out to the side against its band
  sideleg: {
    time: [1.3, 0.35, 1.4, 0.45],
    cam: { yaw: -0.12, y: 0.82, z: 0, half: 1.0 },
    pose: (u) => {
      const a = lerp(0.18, 1.35, smooth(u));   // the right leg's angle away from the standing one
      const ankleX = -0.045 - 0.845 * Math.sin(a), ankleY = 0.922 - 0.845 * Math.cos(a);
      return pose({
        px: 0.05, lean: 0.03,
        lx: 0.07, lz: 0.06, lyaw: 0.1,
        rx: ankleX - 0.085 * Math.sin(a), ry: ankleY - 0.085 * Math.cos(a), rz: 0.13, ryaw: 0, rroll: -a, knee: 0,
        // the stick leans from the floor on the left up to the hands; its upper end's band runs to the standing foot
        sw: 1, tx: 0.36, ty: 0.56, tz: 0.1, tyaw: 3.28, troll: 0.979,
        gl: 0.44, gr: 0.6, wy: 0, wz: 0.05, ex: 0.6, ey: -1, ez: -0.2,
      });
    },
  },
  // standing on the stick with the loops in the hands: down into a squat while the arms reach forward
  reach: {
    time: [1.5, 0.3, 1.3, 0.5],
    cam: { yaw: -0.85, y: 0.86, z: 0.05, half: 1.03 },
    pose: (u) => pose({
      py: lerp(0.922 + ON_STICK, 0.56, u), pz: lerp(0, -0.26, u), lean: lerp(0.05, 0.55, u),
      lx: 0.19, ly: ON_STICK, lz: 0.09, lyaw: 0.2, rx: -0.19, ry: ON_STICK, rz: 0.09, ryaw: -0.2, knee: 0.3,
      sw: 1, tz: 0.02,
      hf: 1, hlx: lerp(0.05, 0.04, u), hly: lerp(1.3, 0.965, u), hlz: lerp(0.2, 0.49, u),
      hrx: -lerp(0.05, 0.04, u), hry: lerp(1.3, 0.965, u), hrz: lerp(0.2, 0.49, u),
      ex: 0.6, ey: -1, ez: 0, bl: 1, br: 1,
    }),
  },
  // standing on the stick with the loops in the hands: one hand stays by the chest, the other presses up
  onearm: {
    time: [1.1, 0.3, 1.5, 0.45],
    cam: { yaw: -0.9, y: 1.0, z: 0, half: 1.2 },
    pose: (u) => pose({
      py: 0.88 + ON_STICK, pz: -0.06, lean: 0.14, lx: 0.17, ly: ON_STICK, rx: -0.17, ry: ON_STICK, knee: 0.2,
      sw: 1, tz: 0.01,
      hf: 1, hlx: lerp(0.25, 0.24, u), hly: lerp(1.4, 1.905, u), hlz: lerp(0.16, 0.03, u),
      hrx: -0.13, hry: 1.24, hrz: 0.17,
      ex: 0.6, ey: -1, ez: 0.2, bl: 1, br: 1,
    }),
  },
};

// ---------- the scene ----------
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 40);

// studio light: a soft sky, a key from the camera's side that throws the floor shadow, a fill, a rim from behind
scene.add(new THREE.HemisphereLight(0xffffff, 0x9fa3aa, 0.95));
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(-2.4, 4.8, 3.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -1.9, right: 1.9, top: 2.4, bottom: -1.4, near: 0.5, far: 14 });
key.shadow.radius = 5;
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.012;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(3, 1.6, 2);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.7);
rim.position.set(1.6, 3, -4);
scene.add(rim);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.2 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ---------- materials ----------
const skin = new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.8 });
const joint = new THREE.MeshStandardMaterial({ color: 0xbfc3c9, roughness: 0.6 });
const shoe = new THREE.MeshStandardMaterial({ color: 0x7d838b, roughness: 0.85 });
const dark = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.55 });
const red = new THREE.MeshStandardMaterial({ color: 0xea0029, roughness: 0.5 });
const rodMat = new THREE.MeshStandardMaterial({ color: LEVELS.strong.rod, roughness: 0.3, metalness: 0.1 });
const foamMat = new THREE.MeshStandardMaterial({ color: LEVELS.strong.foam, roughness: 0.95 });
const bandMat = new THREE.MeshStandardMaterial({ color: LEVELS.strong.band, roughness: 0.4 });

// ---------- the figure's parts ----------
const figure = new THREE.Group();
scene.add(figure);
const part = (geo, mat, parent = figure) => {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};
// a limb hangs from its own origin down the -y axis, so it only has to be put at a joint and pointed at the next
const limb = (rTop, rBottom, length) => part(new THREE.CylinderGeometry(rTop, rBottom, length, 28).translate(0, -length / 2, 0), skin);
const ball = (r, mat = joint) => part(new THREE.SphereGeometry(r, 28, 18), mat);
const solid = (r, sx, sy, sz, mat = skin) => { const m = ball(r, mat); m.scale.set(sx, sy, sz); return m; };

// the chest is turned on a lathe: narrow at the waist, widest under the shoulders, closing toward the neck
const chestProfile = [[0, -0.18], [0.085, -0.176], [0.122, -0.13], [0.146, -0.04], [0.166, 0.06], [0.164, 0.112], [0.132, 0.152], [0.07, 0.172], [0, 0.176]]
  .map(([r, y]) => new THREE.Vector2(r, y));
const chestGeo = new THREE.LatheGeometry(chestProfile, 40);
chestGeo.scale(1.12, 1, 0.68);
chestGeo.computeVertexNormals();

const body = {
  pelvis: solid(0.14, 1.12, 0.74, 0.82),
  waist: solid(0.118, 1.1, 1, 0.8),
  chest: part(chestGeo, skin),
  neck: limb(0.05, 0.046, 0.13),
  head: solid(0.105, 0.92, 1.1, 1),
};

// a darker band across the face, so it is clear which way the figure looks when it is turned
const visor = new THREE.Mesh(new THREE.SphereGeometry(0.1066, 28, 12, Math.PI / 2 - 0.78, 1.56, 1.16, 0.5), joint);
body.head.add(visor);

const SIDES = [1, -1].map((sign) => {
  const foot = new THREE.Group();
  figure.add(foot);
  // the shoe lies along z from the heel (-0.19) to the toe (+0.07), its origin under the ball of the foot
  const sole = part(new THREE.CapsuleGeometry(0.046, 0.165, 8, 20).rotateX(Math.PI / 2), shoe, foot);
  sole.scale.set(1.05, 0.82, 1);
  sole.position.set(0, 0.04, -0.06);
  // the foot loop of the band, with its red label on the outer side
  const strap = new THREE.Group();
  foot.add(strap);
  part(new THREE.BoxGeometry(0.108, 0.074, 0.036), dark, strap).position.set(0, 0.043, -0.07);
  part(new THREE.BoxGeometry(0.005, 0.03, 0.03), red, strap).position.set(sign * 0.0565, 0.05, -0.07);
  return {
    sign, foot, strap,
    v: Object.fromEntries(['shoulder', 'elbow', 'wrist', 'grip', 'hand', 'end', 'far', 'hip', 'knee', 'ankle', 'ball', 'loop'].map((k) => [k, new THREE.Vector3()])),
    footQ: new THREE.Quaternion(),
    shoulderBall: ball(0.06), upperArm: limb(0.048, 0.04, M.upperArm), elbowBall: ball(0.043), forearm: limb(0.039, 0.03, M.forearm),
    fist: solid(0.047, 0.86, 1, 1),
    hipBall: ball(0.08), thigh: limb(0.076, 0.056, M.thigh), kneeBall: ball(0.058), shin: limb(0.054, 0.04, M.shin), ankleBall: ball(0.043),
    band: part(new THREE.CylinderGeometry(1, 1, 1, 14), bandMat),
  };
});

// ---------- the stick: the rod, its foam grip, the end caps with the red labels ----------
const stick = new THREE.Group();
figure.add(stick);
const along = (geo) => geo.rotateZ(Math.PI / 2);
part(along(new THREE.CylinderGeometry(0.0165, 0.0165, 1.3, 28)), rodMat, stick);
part(along(new THREE.CapsuleGeometry(0.0275, 0.66, 8, 28)), foamMat, stick);
for (const s of [1, -1]) {
  part(along(new THREE.CylinderGeometry(0.0205, 0.0205, 0.03, 24)), dark, stick).position.x = s * 0.652;
  part(along(new THREE.CylinderGeometry(0.019, 0.019, 0.012, 24)), red, stick).position.x = s * 0.606;
  part(new THREE.SphereGeometry(0.0145, 16, 12), dark, stick).position.x = s * M.stick;
}

// ---------- solving a pose ----------
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), DOWN = new THREE.Vector3(0, -1, 0);
const J = Object.fromEntries(['pelvis', 'waist', 'chest', 'collar', 'neck', 'head', 'stick'].map((k) => [k, new THREE.Vector3()]));
const Q = Object.fromEntries(['pelvis', 'waist', 'chest', 'head', 'stick'].map((k) => [k, new THREE.Quaternion()]));
const spine = new THREE.Vector3(), axis = new THREE.Vector3(), hint = new THREE.Vector3();
const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tQ = new THREE.Quaternion(), qRoom = new THREE.Quaternion();

// a turn about the upright axis, then a tilt about the side axis, then (for the trunk) a turn about its own length
const turn = (out, yaw, pitch, roll = 0) => {
  out.setFromAxisAngle(Y, yaw).multiply(tQ.setFromAxisAngle(X, pitch));
  return roll ? out.multiply(tQ.setFromAxisAngle(Y, roll)) : out;
};

// the middle joint of a two-part limb (elbow, knee): from the root and where the end must be, bent toward `toward`
const bend = (from, to, a, b, toward, out) => {
  tA.subVectors(to, from);
  let d = tA.length() || 1e-6;
  tA.divideScalar(d);
  d = Math.min(a + b - 0.002, Math.max(Math.abs(a - b) + 0.002, d));
  const run = (a * a - b * b + d * d) / (2 * d);
  const rise = Math.sqrt(Math.max(0, a * a - run * run));
  tB.copy(toward).addScaledVector(tA, -toward.dot(tA));
  if (tB.lengthSq() < 1e-8) tB.set(0, 0, 1);
  tB.normalize();
  return out.copy(from).addScaledVector(tA, run).addScaledVector(tB, rise);
};

const solve = (p) => {
  // the trunk: the hips tilt less than the chest, and the turn builds up along the spine; the head stays up
  turn(Q.pelvis, 0, p.lean * p.pt);
  turn(Q.waist, 0, p.lean * (0.62 + 0.4 * p.pt), p.twist * 0.4);
  turn(Q.chest, 0, p.lean, p.twist);
  turn(Q.head, p.twist * 0.45, p.lean * p.hp);
  J.pelvis.set(p.px, p.py, p.pz);
  spine.set(0, Math.cos(p.lean), Math.sin(p.lean));
  J.waist.copy(J.pelvis).addScaledVector(spine, 0.19);
  J.chest.copy(J.pelvis).addScaledVector(spine, 0.36);
  J.collar.copy(J.pelvis).addScaledVector(spine, M.spine);
  J.neck.copy(J.pelvis).addScaledVector(spine, M.spine + 0.03);
  J.head.set(0, 0.195, 0.012).applyQuaternion(Q.head).add(J.neck);

  // the stick rides on the chest (and may turn against it) or lies in the room; a pose can stand between the two
  Q.stick.copy(Q.chest).multiply(tQ.setFromAxisAngle(Y, p.syaw)).multiply(tQ.setFromAxisAngle(Z, p.sroll));
  J.stick.set(p.sx, p.sy, p.sz).applyQuaternion(Q.chest).add(J.collar);
  if (p.sw > 0) {
    qRoom.setFromAxisAngle(Y, p.tyaw).multiply(tQ.setFromAxisAngle(Z, p.troll));
    Q.stick.slerp(qRoom, p.sw);
    J.stick.lerp(tA.set(p.tx, p.ty, p.tz), p.sw);
  }
  axis.copy(X).applyQuaternion(Q.stick);
  for (const s of SIDES) {
    const k = s.sign, v = s.v, left = k > 0;
    // the hand sits on the stick, or holds a band's loop at a place of its own; the elbow follows
    v.shoulder.set(k * M.shoulder, 0, 0).applyQuaternion(Q.chest).add(J.collar);
    v.grip.copy(J.stick).addScaledVector(axis, left ? p.gl : p.gr);
    v.wrist.set(0, p.wy, p.wz).applyQuaternion(Q.stick).add(v.grip);
    v.hand.copy(v.grip);
    if (p.hf > 0) {
      tA.set(left ? p.hlx : p.hrx, left ? p.hly : p.hry, left ? p.hlz : p.hrz);
      v.wrist.lerp(tA, p.hf);
      v.hand.lerp(tA, p.hf);
    }
    hint.set(k * p.ex, p.ey, p.ez).applyQuaternion(Q.chest);
    bend(v.shoulder, v.wrist, M.upperArm, M.forearm, hint, v.elbow);
    v.end.copy(J.stick).addScaledVector(axis, k * M.stick);

    // the foot stays where the pose puts it, on the floor or in the air; the knee follows the toes
    const yaw = left ? p.lyaw : p.ryaw;
    turn(s.footQ, yaw, left ? p.llift : p.rlift).multiply(tQ.setFromAxisAngle(Z, left ? p.lroll : p.rroll));
    v.ball.set(left ? p.lx : p.rx, left ? p.ly : p.ry, left ? p.lz : p.rz);
    v.ankle.set(0, 0.085, -0.13).applyQuaternion(s.footQ).add(v.ball);
    v.hip.set(k * M.hip, 0, 0).applyQuaternion(Q.pelvis).add(J.pelvis);
    hint.set(k * p.knee, left ? p.khl : p.khr, 1).applyAxisAngle(Y, yaw);
    bend(v.hip, v.ankle, M.thigh, M.shin, hint, v.knee);
    v.loop.set(k * 0.058, 0.074, -0.07).applyQuaternion(s.footQ).add(v.ball);

    // the band runs from the stick's end to the loop: on the foot, or in the hand
    s.inHand = left ? p.bl : p.br;
    v.far.copy(v.loop).lerp(v.hand, s.inHand);
  }
};

// the mean length of the two bands in the pose just solved
const bandLength = () => (SIDES[0].v.end.distanceTo(SIDES[0].v.far) + SIDES[1].v.end.distanceTo(SIDES[1].v.far)) / 2;

const aim = (mesh, from, to) => {
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(DOWN, tA.subVectors(to, from).normalize());
};

const place = () => {
  body.pelvis.position.set(0, 0.05, 0).applyQuaternion(Q.pelvis).add(J.pelvis);
  body.pelvis.quaternion.copy(Q.pelvis);
  body.waist.position.copy(J.waist);
  body.waist.quaternion.copy(Q.waist);
  body.chest.position.copy(J.chest);
  body.chest.quaternion.copy(Q.chest);
  aim(body.neck, J.neck, J.head);
  body.head.position.copy(J.head);
  body.head.quaternion.copy(Q.head);
  stick.position.copy(J.stick);
  stick.quaternion.copy(Q.stick);
  for (const s of SIDES) {
    const v = s.v;
    s.shoulderBall.position.copy(v.shoulder);
    aim(s.upperArm, v.shoulder, v.elbow);
    s.elbowBall.position.copy(v.elbow);
    aim(s.forearm, v.elbow, v.wrist);
    s.fist.position.copy(v.hand);
    s.fist.quaternion.copy(Q.stick);
    s.hipBall.position.copy(v.hip);
    aim(s.thigh, v.hip, v.knee);
    s.kneeBall.position.copy(v.knee);
    aim(s.shin, v.knee, v.ankle);
    s.ankleBall.position.copy(v.ankle);
    s.foot.position.copy(v.ball);
    s.foot.quaternion.copy(s.footQ);
    // the loop is drawn on the foot only while the foot wears it
    s.strap.visible = s.inHand < 0.98;
    s.strap.scale.setScalar(Math.max(0.001, 1 - s.inHand));
    // a band is a straight line from the stick's end to its loop, and it thins as it is pulled longer
    tA.subVectors(v.far, v.end);
    const length = tA.length();
    const r = 0.0098 * Math.sqrt(1 / length);
    s.band.position.copy(v.end).addScaledVector(tA, 0.5);
    s.band.quaternion.setFromUnitVectors(Y, tA.divideScalar(length));
    s.band.scale.set(r, length, r);
  }
};

// how long the bands are at the two ends of each movement, for the stretch meter
for (const move of Object.values(MOVES)) {
  let min = Infinity, max = 0;
  for (let i = 0; i <= 24; i++) {
    solve(move.pose(i / 24));
    const length = bandLength();
    min = Math.min(min, length);
    max = Math.max(max, length);
  }
  move.band = { min, span: Math.max(0.001, max - min) };
}

// ---------- state and controls ----------
const picks = [...root.querySelectorAll('.moves3d__pick')];
const playBtn = root.querySelector('[data-moves3d-play]');
const slowBtn = root.querySelector('[data-moves3d-slow]');
const now = root.querySelector('[data-moves3d-now]');
const meter = root.querySelector('[data-moves3d-meter]');

const first = picks[0].dataset.move;
const state = {
  move: first, t: -0.4, playing: !calm, slow: false, fixed: calm ? 1 : null,
  from: null, blend: 1, shown: MOVES[first].pose(calm ? 1 : 0),
  yaw: MOVES[first].cam.yaw, yawGoal: MOVES[first].cam.yaw, pitch: 0.12, pitchGoal: 0.12,
  y: MOVES[first].cam.y, z: MOVES[first].cam.z, half: MOVES[first].cam.half,
  visible: false, w: 0, h: 0,
};

// where in the movement the clock is: going out, holding, coming back, resting
const phase = (move, t) => {
  const [go, hold, back, rest] = move.time;
  if (t < 0) return 0;
  t %= go + hold + back + rest;
  const ease = (x) => (1 - Math.cos(Math.PI * x)) / 2;
  if (t < go) return ease(t / go);
  if (t < go + hold) return 1;
  if (t < go + hold + back) return 1 - ease((t - go - hold) / back);
  return 0;
};

const describe = () => {
  const btn = picks.find((b) => b.dataset.move === state.move);
  const name = btn.querySelector('.moves3d__name').textContent;
  const how = btn.querySelector('.moves3d__how').textContent;
  picks.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  now.textContent = how;
  canvas.setAttribute('aria-label', `דמות תלת־ממדית מדגימה: ${name}. ${how}`);
};
const showPlay = () => { playBtn.textContent = state.playing ? 'עצירה' : 'הפעלה'; };

const select = (id) => {
  if (!MOVES[id] || id === state.move) return;
  // the figure walks from the pose it is in to the start of the new movement
  state.from = { ...state.shown };
  state.blend = calm ? 1 : 0;
  state.move = id;
  state.t = -0.45;
  state.yawGoal = MOVES[id].cam.yaw;
  state.pitchGoal = 0.12;
  describe();
};
picks.forEach((b) => b.addEventListener('click', () => select(b.dataset.move)));

playBtn.addEventListener('click', () => {
  state.playing = !state.playing;
  if (state.playing) state.fixed = null;
  showPlay();
});
slowBtn.addEventListener('click', () => {
  state.slow = !state.slow;
  slowBtn.setAttribute('aria-pressed', String(state.slow));
});
root.querySelectorAll('[data-moves3d-view]').forEach((b) => b.addEventListener('click', () => {
  state.yawGoal = b.dataset.moves3dView === 'side' ? -Math.PI / 2 : 0;
  state.pitchGoal = 0.08;
  touched();
}));

const touched = () => root.classList.add('is-touched');
let drag = null;
canvas.addEventListener('pointerdown', (ev) => {
  drag = { x: ev.clientX, y: ev.clientY };
  canvas.setPointerCapture(ev.pointerId);
  canvas.classList.add('is-dragging');
  touched();
});
canvas.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  state.yawGoal -= (ev.clientX - drag.x) * 0.0085;
  state.pitchGoal = Math.min(0.75, Math.max(-0.05, state.pitchGoal + (ev.clientY - drag.y) * 0.005));
  drag = { x: ev.clientX, y: ev.clientY };
});
const endDrag = () => { drag = null; canvas.classList.remove('is-dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('keydown', (ev) => {
  const step = { ArrowLeft: [0.2, 0], ArrowRight: [-0.2, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[ev.key];
  if (!step) return;
  ev.preventDefault();
  touched();
  state.yawGoal += step[0];
  state.pitchGoal = Math.min(0.75, Math.max(-0.05, state.pitchGoal + step[1]));
});

// the stick takes the colour of the kit chosen on the page
const colourGoal = { rod: new THREE.Color(LEVELS.strong.rod), foam: new THREE.Color(LEVELS.strong.foam), band: new THREE.Color(LEVELS.strong.band) };
const setLevel = (id) => {
  const L = LEVELS[id];
  if (!L) return;
  colourGoal.rod.setHex(L.rod); colourGoal.foam.setHex(L.foam); colourGoal.band.setHex(L.band);
};
const kits = [...document.querySelectorAll('input[name="kit"]')];
kits.forEach((i) => i.addEventListener('change', () => i.checked && setLevel(i.value)));
const chosen = kits.find((i) => i.checked);
if (chosen) setLevel(chosen.value);
rodMat.color.copy(colourGoal.rod); foamMat.color.copy(colourGoal.foam); bandMat.color.copy(colourGoal.band);

// ---------- size ----------
const resize = () => {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h || (w === state.w && h === state.h)) return;
  state.w = w; state.h = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(stage);

// ---------- the frame ----------
const clock = new THREE.Clock();
const frame = () => {
  requestAnimationFrame(frame);
  if (!state.visible || !state.w) return;
  const dt = Math.min(0.1, clock.getDelta());
  const k = calm ? 1 : 1 - Math.exp(-dt * 5);
  const move = MOVES[state.move];

  if (state.playing) state.t += dt * (state.slow ? 0.4 : 1);
  const target = move.pose(state.fixed === null ? phase(move, state.t) : state.fixed);
  if (state.blend < 1) {
    state.blend = Math.min(1, state.blend + dt / 0.55);
    const mix = smooth(state.blend);
    for (const key of Object.keys(target)) state.shown[key] = lerp(state.from[key], target[key], mix);
  } else {
    state.shown = target;
  }
  solve(state.shown);
  place();

  // the camera turns about the figure and keeps the whole movement in the frame, on a wide stage or a tall one
  state.yaw += (state.yawGoal - state.yaw) * k;
  state.pitch += (state.pitchGoal - state.pitch) * k;
  state.y += (move.cam.y - state.y) * k;
  state.z += (move.cam.z - state.z) * k;
  state.half += (move.cam.half - state.half) * k;
  const tan = Math.tan((camera.fov * Math.PI) / 360);
  const dist = Math.max(state.half / tan, 0.98 / (tan * camera.aspect));
  const cp = Math.cos(state.pitch);
  camera.position.set(dist * Math.sin(state.yaw) * cp, state.y + dist * Math.sin(state.pitch), state.z + dist * Math.cos(state.yaw) * cp);
  camera.lookAt(0, state.y, state.z);

  rodMat.color.lerp(colourGoal.rod, k); foamMat.color.lerp(colourGoal.foam, k); bandMat.color.lerp(colourGoal.band, k);
  const stretch = Math.min(1, Math.max(0, (bandLength() - move.band.min) / move.band.span));
  meter.style.transform = `scaleX(${(0.06 + 0.94 * stretch).toFixed(3)})`;

  renderer.render(scene, camera);
};

// for checking a pose by hand from the console: root.showPose('lunge', 1, -1.2)
root.showPose = (id, u, yaw) => {
  state.move = MOVES[id] ? id : state.move;
  state.fixed = u;
  state.playing = false;
  state.blend = 1;
  if (typeof yaw === 'number') state.yaw = state.yawGoal = yaw;
  describe();
  showPlay();
};

new IntersectionObserver((entries) => { state.visible = entries[0].isIntersecting; }, { rootMargin: '200px 0px' }).observe(stage);
describe();
showPlay();
resize();
requestAnimationFrame(frame);
})();
