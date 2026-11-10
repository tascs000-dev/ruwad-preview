// Ruwad Direction D: the official mark as a 3D object (geometry from the traced official logo, unchanged).
import * as THREE from './vendor/three.module.min.js';
import { MARK } from './markpts.js';

const CX = 190.5, CY = 193, S = 1 / 190;

function shapeFrom(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    const X = (x - CX) * S, Y = -(y - CY) * S;
    i ? s.lineTo(X, Y) : s.moveTo(X, Y);
  });
  s.closePath();
  return s;
}

// Gradient exactly from the logo: #EB473D -> #F0965B, left to right, ~10deg tilt.
const vert = `
varying vec3 vN; varying vec3 vP; varying vec2 vXY;
uniform float uPart;
void main(){
  vec4 wp = modelMatrix * vec4(position,1.0);
  vXY = position.xy;
  vN = normalize(normalMatrix * normal);
  vP = (viewMatrix * wp).xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const frag = `
varying vec3 vN; varying vec3 vP; varying vec2 vXY;
uniform vec3 cA; uniform vec3 cB; uniform float uGlow;
void main(){
  float t = clamp((vXY.x + vXY.y*0.18) * 0.5 + 0.5, 0.0, 1.0);
  vec3 base = mix(cA, cB, t);
  vec3 N = normalize(vN);
  vec3 V = normalize(-vP);
  vec3 L = normalize(vec3(-0.4, 0.6, 0.9));
  float diff = 0.82 + 0.28 * max(dot(N, L), 0.0);
  float side = 1.0 - abs(N.z);              // extrusion walls
  vec3 col = base * diff;
  col = mix(col, base * 0.62, side * 0.7);   // darker walls
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 28.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(1.0, 0.85, 0.7) * spec * 0.35 + vec3(1.0, 0.6, 0.4) * fres * 0.25 * uGlow;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function initMark(canvas, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
    uniforms: { cA: { value: new THREE.Color('#EB473D') }, cB: { value: new THREE.Color('#F0965B') }, uGlow: { value: 1 }, uPart: { value: 0 } }
  });
  const ext = { depth: 0.22, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.022, bevelSegments: 3, curveSegments: 4 };
  const group = new THREE.Group();
  const parts = MARK.map(p => {
    const g = new THREE.ExtrudeGeometry(shapeFrom(p), ext);
    g.translate(0, 0, -0.11);
    const m = new THREE.Mesh(g, mat);
    group.add(m);
    return m;
  });
  scene.add(group);

  // Ember dust: soft points drifting upward (dawn light catching dust).
  const N = innerWidth < 700 ? 260 : 650;
  const pg = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), sp = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12; pos[i * 3 + 1] = (Math.random() - 0.5) * 8; pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    sp[i] = 0.15 + Math.random() * 0.5;
  }
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: 0xF0965B, size: 0.028, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(pg, pm);
  scene.add(dust);

  const state = { part: 0, rotY: 0, rotX: 0, x: 0, y: 0, scale: 1, px: 0, py: 0, glow: 1, dustOpacity: 0.75 };
  addEventListener('pointermove', e => { state.px = e.clientX / innerWidth - 0.5; state.py = e.clientY / innerHeight - 0.5; }, { passive: true });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.z = w < 700 ? 9.5 : 7.4;
  }
  resize(); addEventListener('resize', resize);

  let visible = true, t0 = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  const sm = { rx: 0, ry: 0 };
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = (now - t0) / 1000;
    const idle = reduce ? 0 : Math.sin(t * 0.6) * 0.12;
    sm.rx += ((reduce ? 0 : state.py * 0.35) - sm.rx) * 0.06;
    sm.ry += ((reduce ? 0 : state.px * 0.6) - sm.ry) * 0.06;
    group.rotation.set(state.rotX + sm.rx, state.rotY + sm.ry + idle, 0);
    group.position.set(state.x, state.y + (reduce ? 0 : Math.sin(t * 0.9) * 0.05), 0);
    group.scale.setScalar(state.scale);
    // The two pieces part along the channel, then return to the exact official form.
    parts[1].position.set(state.part * 0.35, -state.part * 0.35, state.part * 0.5);
    parts[0].position.set(-state.part * 0.1, state.part * 0.1, -state.part * 0.2);
    mat.uniforms.uGlow.value = state.glow;
    if (!reduce) {
      const a = pg.attributes.position.array;
      for (let i = 0; i < N; i++) { a[i * 3 + 1] += sp[i] * 0.004; if (a[i * 3 + 1] > 4) a[i * 3 + 1] = -4; }
      pg.attributes.position.needsUpdate = true;
    }
    pm.opacity = state.dustOpacity;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return state;
}
