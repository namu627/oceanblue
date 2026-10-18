import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { addSwim, fbm, rockGeometry, sardineGeometry } from './creatures.js'
import { BREAK_X, makeChest, makeLabel, makeLiftBag, makeROV, makeWreck } from './explorer.js'

// ─────────────────────────────────────────────────────────────
// 수심 다이빙 씬. 상태 객체 S를 GSAP가 트윈하고, tick()이 매 프레임 S를 읽어 반영한다.
//   S.y      카메라 높이(수면 = 0, 아래로 음수)
//   S.pitch  카메라 상하 각도
//   S.camX   카메라 x (모바일 히어로에서 부표를 가운데로)
//   S.shiftX / S.shiftY  화면 안에서 오브젝트를 옆/위로 비켜 세우는 비율 (패널 자리 확보)
//   L[i]     챕터 i의 내부 진행도 0..1 (물고기 정렬, 타일 물들기 등)
// ─────────────────────────────────────────────────────────────

export const BUOY_X = 3.4
export const LANDMARK_Y = [-14, -30, -46, -62, -78]
export const LANDMARK_Z = [0, -44, -84, -112, -146] // 지형을 따라 앞으로 나아가며 내려간다
const DEPTH_M = [0, 30, 200, 1000, 2400, 4000]
const DEPTH_Y = [0, ...LANDMARK_Y]
const SEABED_Y = -80.6
const BUOY = new THREE.Vector3(BUOY_X, 0, -1.6)
// 5단계: 인양할 보물상자가 놓인 자리. 여기서 수면까지 곧장 올라간다 (Why 장면도 이 위 수면)
export const LIFT = { x: 1.8, z: -144.2 }
// 인양 풍선이 떠오르는 곳: 처음 장면의 부표 바로 옆 (처음과 끝이 이어진다)
export const SURF = { x: BUOY_X - 1.5, z: -1.0 }

// 화면 표시용 수심(m). 구간별 선형 보간.
export function depthMeters(y) {
  if (y >= 0) return 0
  for (let i = 1; i < DEPTH_Y.length; i++) {
    if (y >= DEPTH_Y[i]) {
      const t = (y - DEPTH_Y[i - 1]) / (DEPTH_Y[i] - DEPTH_Y[i - 1])
      return DEPTH_M[i - 1] + t * (DEPTH_M[i] - DEPTH_M[i - 1])
    }
  }
  return DEPTH_M[DEPTH_M.length - 1] + (DEPTH_Y.at(-1) - y) * 20
}

// 해저 높이. 대륙붕(얕은 평지)에서 절벽 계단을 하나씩 내려가 심해 평원에 닿는다.
const SHELF_Y = -19.5
const STEPS = [
  { z: -6, len: 18, to: -31.5 }, // 대륙붕에서 소나 고원까지는 완만한 사면
  { z: -67, len: 7, to: -52 },
  { z: -95, len: 7, to: -64 },
  { z: -123, len: 8, to: SEABED_Y },
]
export function terrainH(x, z) {
  let h = SHELF_Y
  let prev = SHELF_Y
  let cliff = 0
  for (let i = 0; i < STEPS.length; i++) {
    const s = STEPS[i]
    const edge = s.z + fbm(x * 0.06, i * 4.7, 1.3) * 9 // 절벽선이 들쭉날쭉하게
    const u = THREE.MathUtils.clamp((edge - z) / s.len, 0, 1)
    h += (s.to - prev) * u * u * (3 - 2 * u)
    cliff = Math.max(cliff, 4 * u * (1 - u))
    prev = s.to
  }
  // 대륙붕·심해 평원은 부드러운 퇴적층, 그 사이 계단 면은 암반
  const rocky = THREE.MathUtils.smoothstep(-z, 0, 22) * (1 - THREE.MathUtils.smoothstep(-z, 118, 130))
  h += fbm(x * 0.07, 2.1, z * 0.07) * (1.2 + rocky * 0.8) // 넓은 기복
  const ridge = 1 - Math.abs(fbm(x * 0.16, 5.3, z * 0.16))
  h += THREE.MathUtils.smoothstep(ridge, 0.7, 1) * 1.6 * (1 - cliff) * rocky // 암반 능선
  h += fbm(x * 0.28, 8.8, z * 0.28, 2) * (0.12 + rocky * 0.2 + cliff * 1.1) // 잔요철, 절벽면은 거칠게
  // 소나 챕터 암초 지대: 굽이진 수로 양옆으로 암반이 솟는다.
  // 대륙붕 쪽(rz > 0)으로 길게 늘여서 정어리 아래 모래밭부터 낮은 골짜기로 시작해 사면을 타고 이어진다.
  const rz = z - LANDMARK_Z[1]
  const reefM = (1 - THREE.MathUtils.smoothstep(Math.hypot(x * 0.5, rz * (rz > 0 ? 0.5 : 0.75)), 16, 30)) * (1 - 0.6 * THREE.MathUtils.smoothstep(rz, 12, 44))
  if (reefM > 0) {
    const bank = THREE.MathUtils.smoothstep(Math.abs(x - channelX(rz)), 1.0, 3.8)
    const crag = 0.5 + 0.5 * fbm(x * 0.2, 11.7, z * 0.2, 3) + 0.35 * (1 - Math.abs(fbm(x * 0.13, 4.4, z * 0.13, 2)))
    h += reefM * bank * (0.8 + crag * 3.2)
  }
  return h
}
export const channelX = (rz) => Math.sin(rz * 0.2) * 1.5 - 0.3

// 수심별 물빛. y가 내려갈수록 청록 → 남색 → 거의 검정.
const WATER = [
  { y: 0, c: new THREE.Color('#0b6f9c'), d: 0.05 },
  { y: -14, c: new THREE.Color('#07527d'), d: 0.06 },
  { y: -30, c: new THREE.Color('#05335a'), d: 0.064 },
  { y: -46, c: new THREE.Color('#031d3a'), d: 0.068 },
  { y: -62, c: new THREE.Color('#020f22'), d: 0.07 },
  { y: -78, c: new THREE.Color('#010712'), d: 0.072 },
]
function waterAt(y, outColor) {
  if (y >= WATER[0].y) return outColor.copy(WATER[0].c), WATER[0].d
  for (let i = 1; i < WATER.length; i++) {
    if (y >= WATER[i].y) {
      const t = (y - WATER[i - 1].y) / (WATER[i].y - WATER[i - 1].y)
      outColor.copy(WATER[i - 1].c).lerp(WATER[i].c, t)
      return THREE.MathUtils.lerp(WATER[i - 1].d, WATER[i].d, t)
    }
  }
  outColor.copy(WATER.at(-1).c)
  return WATER.at(-1).d
}

// ── 파도: JS와 GLSL이 같은 식을 쓴다 (부표가 물결을 정확히 탄다) ──
const WAVES = [
  [1.0, 0.3, 0.16, 0.45, 1.1],
  [-0.4, 1.0, 0.11, 0.7, 1.4],
  [0.7, -0.6, 0.06, 1.3, 1.9],
  [0.2, 0.9, 0.035, 2.3, 2.6],
].map(([x, z, a, k, s]) => {
  const l = Math.hypot(x, z)
  return [x / l, z / l, a, k, s]
})
function waveH(x, z, t) {
  let h = 0
  for (const [dx, dz, a, k, s] of WAVES) h += a * Math.sin((dx * x + dz * z) * k + t * s)
  return h
}
function waveSlope(x, z, t) {
  let sx = 0
  let sz = 0
  for (const [dx, dz, a, k, s] of WAVES) {
    const c = a * k * Math.cos((dx * x + dz * z) * k + t * s)
    sx += c * dx
    sz += c * dz
  }
  return [sx, sz]
}
const WAVE_GLSL = `
uniform float uTime;
const vec4 W0 = vec4(${WAVES[0].slice(0, 4).map((v) => v.toFixed(5)).join(',')});
const vec4 W1 = vec4(${WAVES[1].slice(0, 4).map((v) => v.toFixed(5)).join(',')});
const vec4 W2 = vec4(${WAVES[2].slice(0, 4).map((v) => v.toFixed(5)).join(',')});
const vec4 W3 = vec4(${WAVES[3].slice(0, 4).map((v) => v.toFixed(5)).join(',')});
const vec4 WS = vec4(${WAVES.map((w) => w[4].toFixed(3)).join(',')});
void wave(vec4 w, float s, vec2 p, inout float h, inout vec2 d) {
  float ph = dot(w.xy, p) * w.w + uTime * s;
  h += w.z * sin(ph);
  d += w.z * w.w * cos(ph) * w.xy;
}
`

const MOON_DIR = new THREE.Vector3(0.42, 0.16, -1).normalize()

// 부드러운 원형 글로우 텍스처 (별·조명 헤일로 공용)
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.18, 'rgba(255,255,255,0.55)')
  r.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function createOcean(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900)
  camera.rotation.order = 'YXZ'

  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.fog = new THREE.FogExp2(new THREE.Color('#0b6f9c'), 0.05)

  const S = { y: 2.2, z: 0, look: 0, far: 1, pitch: -0.1, camX: 0, shiftX: 0, shiftY: 0, dist: 8, mx: 0, my: 0, why: 0, rov: 0, rov2: 0, follow: 0, lift: 0 }
  // S.rov / S.rov2: 탐사선 이동 진행도(3 → 4단계 / 4 → 5단계), S.follow: 카메라가 탐사선 뒤를 따라붙는 정도, S.lift: 인양 풍선 상승(5단계 → 수면)
  const L = [0, 0, 0, 0, 0]
  const glow = glowTexture()
  const timeU = { value: 0 }
  const disposables = [glow, pmrem]

  // ── 조명 ──
  const hemi = new THREE.HemisphereLight('#bfe9ff', '#06223f', 1.2)
  const moon = new THREE.DirectionalLight('#dbeeff', 1.6)
  moon.position.copy(MOON_DIR).multiplyScalar(40)
  const torch = new THREE.PointLight('#bff3ff', 0, 26, 1.4) // 잠수 랜턴: 깊어질수록 켜짐
  scene.add(hemi, moon, torch)

  // ── 하늘 ──
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color('#020814') },
      uMid: { value: new THREE.Color('#0a2346') },
      uHorizon: { value: new THREE.Color('#2a6d9e') },
      uMoon: { value: MOON_DIR },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uMoon;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.18, h));
        col = mix(col, uZenith, smoothstep(0.15, 0.7, h));
        float m = max(dot(d, uMoon), 0.0);
        col += vec3(0.45, 0.68, 0.9) * pow(m, 24.0) * 0.28;
        col += vec3(0.9, 0.97, 1.0) * smoothstep(0.99955, 0.99975, m) * 1.6;
        vec3 cell = floor(d * 900.0);
        float s = hash(cell);
        float star = step(0.9985, s) * smoothstep(0.1, 0.4, h);
        col += vec3(0.75, 0.88, 1.0) * star * (0.45 + 0.55 * hash(cell + 3.1));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), skyMat)
  sky.frustumCulled = false
  sky.renderOrder = -1
  scene.add(sky)

  // ── 수면 ──
  const surfGeo = new THREE.PlaneGeometry(420, 420, 260, 260)
  surfGeo.rotateX(-Math.PI / 2)
  const surfMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uTime: timeU,
      uDeep: { value: new THREE.Color('#021428') },
      uSkyLo: { value: new THREE.Color('#2a6d9e') },
      uSkyHi: { value: new THREE.Color('#06142b') },
      uMoon: { value: MOON_DIR },
      uUnder: { value: new THREE.Color('#0b6f9c') },
      uWindow: { value: new THREE.Color('#bff4ff') },
      uFog: { value: new THREE.Color('#0b6f9c') },
      uFogD: { value: 0.05 },
    },
    vertexShader: `
      ${WAVE_GLSL}
      varying vec3 vPos; varying vec3 vN;
      void main() {
        vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
        float h = 0.0; vec2 d = vec2(0.0);
        wave(W0, WS.x, p.xz, h, d); wave(W1, WS.y, p.xz, h, d);
        wave(W2, WS.z, p.xz, h, d); wave(W3, WS.w, p.xz, h, d);
        p.y += h;
        vPos = p;
        vN = normalize(vec3(-d.x, 1.0, -d.y));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep; uniform vec3 uSkyLo; uniform vec3 uSkyHi; uniform vec3 uMoon;
      uniform vec3 uUnder; uniform vec3 uWindow; uniform vec3 uFog; uniform float uFogD;
      varying vec3 vPos; varying vec3 vN;
      void main() {
        vec3 V = normalize(cameraPosition - vPos);
        float dist = length(cameraPosition - vPos);
        vec3 N = normalize(vN);
        vec3 col;
        if (gl_FrontFacing) {
          // 수면 위에서 본 바다: 프레넬 반사 + 달빛 반짝임 + 수평선 안개
          float fr = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 R = reflect(-V, N);
          vec3 skyc = mix(uSkyLo, uSkyHi, smoothstep(0.0, 0.5, R.y));
          col = mix(uDeep, skyc, fr);
          float sp = max(dot(R, uMoon), 0.0);
          col += vec3(0.85, 0.95, 1.0) * (pow(sp, 900.0) * 1.6 + pow(sp, 60.0) * 0.06);
          col = mix(col, uSkyLo, smoothstep(40.0, 260.0, dist));
        } else {
          // 물속에서 올려다본 수면: 스넬의 창 + 전반사
          vec3 Nd = -N;
          float c = max(dot(Nd, V), 0.0);
          col = mix(uUnder * 0.7, uWindow, pow(c, 5.0));
          float ripple = sin(vPos.x * 3.1 + uTime * 1.3) * sin(vPos.z * 2.7 - uTime * 1.1);
          col += uWindow * 0.12 * smoothstep(0.55, 1.0, ripple) * c;
          float f = 1.0 - exp(-pow(uFogD * dist, 2.0));
          col = mix(col, uFog, f);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const surface = new THREE.Mesh(surfGeo, surfMat)
  surface.frustumCulled = false
  scene.add(surface)

  // ── 신호 부표 (통신 부이) ──
  const buoy = new THREE.Group()
  const navy = new THREE.MeshStandardMaterial({ color: '#12345c', metalness: 0.35, roughness: 0.45 })
  const white = new THREE.MeshStandardMaterial({ color: '#e6eef5', metalness: 0.1, roughness: 0.35 })
  const steel = new THREE.MeshStandardMaterial({ color: '#8ea3b5', metalness: 0.9, roughness: 0.28 })
  const panelMat = new THREE.MeshStandardMaterial({ color: '#0b1f3d', metalness: 0.7, roughness: 0.2 })
  const cyanGlow = new THREE.MeshBasicMaterial({ color: '#7cecff' })
  const lower = new THREE.LatheGeometry(
    [[0, -1.0], [0.34, -0.97], [0.68, -0.72], [0.9, -0.36], [0.98, -0.06], [1.0, 0.02]].map(([r, y]) => new THREE.Vector2(r, y)),
    48,
  )
  const upper = new THREE.LatheGeometry(
    [[1.0, 0.02], [0.98, 0.22], [0.86, 0.34], [0.5, 0.4], [0, 0.42]].map(([r, y]) => new THREE.Vector2(r, y)),
    48,
  )
  buoy.add(new THREE.Mesh(lower, navy), new THREE.Mesh(upper, white))
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.035, 8, 64), cyanGlow)
  band.rotation.x = Math.PI / 2
  band.position.y = 0.08
  buoy.add(band)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.5, 8), steel)
    const base = new THREE.Vector3(Math.cos(a) * 0.55, 0.38, Math.sin(a) * 0.55)
    const top = new THREE.Vector3(Math.cos(a) * 0.12, 1.75, Math.sin(a) * 0.12)
    leg.position.copy(base).add(top).multiplyScalar(0.5)
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(base).normalize())
    buoy.add(leg)
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.36), panelMat)
    sp.position.set(Math.cos(a + 1.05) * 0.42, 1.05, Math.sin(a + 1.05) * 0.42)
    sp.rotation.y = -(a + 1.05)
    sp.rotation.z = 0.95
    buoy.add(sp)
  }
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 24), steel)
  plat.position.y = 1.77
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.1, 8), steel)
  mast.position.y = 2.35
  buoy.add(plat, mast)
  for (const [y, r] of [[2.15, 0.16], [2.45, 0.12]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 32), steel)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    buoy.add(ring)
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12), cyanGlow.clone())
  beacon.position.y = 1.93
  const beaconHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#7cecff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
  beaconHalo.scale.setScalar(1.6)
  beaconHalo.position.y = 1.93
  const beaconLight = new THREE.PointLight('#7cecff', 4, 9, 1.6)
  beaconLight.position.y = 1.93
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 12), steel)
  shaft.position.y = -1.45
  const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.36, 20), navy)
  weight.position.y = -2.0
  buoy.add(beacon, beaconHalo, beaconLight, shaft, weight)
  buoy.scale.setScalar(0.92)
  buoy.position.copy(BUOY)
  scene.add(buoy)

  // ── 부표에서 해저까지 이어진 통신 라인 + 데이터 펄스 ──
  const cablePts = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    const y = -2.0 + t * (terrainH(BUOY.x + 0.6, BUOY.z - 2.2) + 2.0)
    cablePts.push(new THREE.Vector3(BUOY.x + Math.sin(t * 5.0) * 0.35 + t * 0.6, y, BUOY.z - t * 2.2 + Math.cos(t * 4) * 0.25))
  }
  const cableCurve = new THREE.CatmullRomCurve3(cablePts)
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 420, 0.03, 6), new THREE.MeshStandardMaterial({ color: '#2b4058', metalness: 0.6, roughness: 0.5 }))
  scene.add(cable)
  const pulses = []
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#6fe6ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    sp.scale.setScalar(0.55)
    scene.add(sp)
    pulses.push(sp)
  }

  // ── 빛내림 (god rays) ──
  const rayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { uTime: timeU, uOpacity: { value: 1 }, uColor: { value: new THREE.Color('#9eeeff') } },
    vertexShader: `
      attribute float aSeed; varying vec2 vUv; varying float vSeed;
      void main() { vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uOpacity; uniform vec3 uColor;
      varying vec2 vUv; varying float vSeed;
      void main() {
        float edge = pow(sin(vUv.x * 3.14159), 2.0);
        float fall = pow(vUv.y, 2.2);
        float flick = 0.55 + 0.45 * sin(uTime * (0.35 + vSeed * 0.4) + vSeed * 30.0);
        float a = edge * fall * flick * uOpacity * 0.16;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }`,
  })
  const rays = new THREE.Group()
  for (let i = 0; i < 16; i++) {
    const g = new THREE.PlaneGeometry(1 + Math.random() * 1.8, 34)
    g.translate(0, -17, 0)
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(4).fill(Math.random()), 1))
    const m = new THREE.Mesh(g, rayMat)
    m.position.set(-14 + Math.random() * 28, 0.2, -16 + Math.random() * 16)
    m.rotation.set(0, Math.random() * Math.PI, -0.18 + Math.random() * 0.1)
    rays.add(m)
  }
  scene.add(rays)

  // ── 마린 스노우 ──
  function points(count, box, color, size, rise) {
    const pts = makePointsMesh(count, box, color, size)
    pts.material.uniforms.uRise.value = rise
    pts.frustumCulled = false
    scene.add(pts)
    return pts
  }
  function makePointsMesh(count, box, color, size) {
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = box[0] + Math.random() * (box[1] - box[0])
      pos[i * 3 + 1] = box[2] + Math.random() * (box[3] - box[2])
      pos[i * 3 + 2] = box[4] + Math.random() * (box[5] - box[4])
      seed[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: {
        uTime: timeU,
        uColor: { value: new THREE.Color(color) },
        uSize: { value: size },
        uPR: { value: renderer.getPixelRatio() },
        uRise: { value: 0 },
        uSpan: { value: box[3] - box[2] },
        uBottom: { value: box[2] },
      },
      vertexShader: `
        uniform float uTime; uniform float uSize; uniform float uPR; uniform float uRise; uniform float uSpan; uniform float uBottom;
        attribute float aSeed; varying float vA;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.35;
          p.z += cos(uTime * 0.25 + aSeed * 23.0) * 0.35;
          p.y += sin(uTime * 0.17 + aSeed * 60.0) * 0.4;
          p.y = uBottom + mod(p.y - uBottom + uTime * uRise * (0.6 + aSeed), uSpan);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * uPR * (0.5 + aSeed) / -mv.z;
          vA = smoothstep(26.0, 5.0, -mv.z) * smoothstep(0.4, 1.6, -mv.z) * step(p.y, -0.25) * (0.35 + 0.65 * aSeed);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA;
          gl_FragColor = vec4(uColor * a, a);
          #include <colorspace_fragment>
        }`,
    })
    return new THREE.Points(g, m)
  }
  points(14000, [-18, 18, SEABED_Y, -0.3, -165, 10], '#cdefff', 34, -0.05) // 마린 스노우
  points(160, [-5, 6, -12, -0.3, 1, 7], '#e6fbff', 60, 0.9) // 기포

  // ═════════ 챕터 랜드마크 ═════════
  const marks = LANDMARK_Y.map((y, i) => {
    const g = new THREE.Group()
    g.position.set(0, y, LANDMARK_Z[i])
    scene.add(g)
    return g
  })
  const rim = new THREE.DirectionalLight('#8fe6ff', 0) // 심해 윤곽광: 깊어질수록 켜짐
  rim.position.set(-6, 9, -8)
  scene.add(rim)

  // 1) −30m 정어리 떼 — 제각각 돌던 떼가 한 방향 대열로 정렬 (감이 아닌 데이터로 판단)
  const FISH_N = 320
  const fishGeo = sardineGeometry()
  fishGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(FISH_N).map(() => Math.random() * 6.283), 1))
  const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.28, side: THREE.DoubleSide })
  addSwim(fishMat, { time: timeU, axis: 'z', from: 0.25, span: 0.8, freq: 11, wave: 5, amp: 0.045, instanced: true })
  const fish = new THREE.InstancedMesh(fishGeo, fishMat, FISH_N)
  fish.frustumCulled = false
  // 대열 모양: 머리(+x, 진행 방향)는 둥글고 꼬리로 갈수록 가늘어지는 물방울 떼가, 옆으로 완만한 S자로 휘어 흐른다.
  // 격자 대신 무작위로 뿌리되 서로 너무 붙지 않게(최소 간격) 골라 자연스럽게.
  const L0 = 2.6 // 떼 길이의 절반
  const bend = (x) => [Math.sin(x * 0.75) * 0.55, Math.sin(x * 0.9 + 1.2) * 0.22] // [z, y] 휘어짐
  const radius = (x) => {
    const u = (x + L0) / (2 * L0) // 0 = 꼬리, 1 = 머리
    return 0.12 + 0.95 * Math.pow(Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5), 1.6) * (1 - Math.pow(Math.max(0, u - 0.82) / 0.18, 2) * 0.55)
  }
  const picked = []
  const MIN_D = 0.17
  for (let tries = 0; picked.length < FISH_N && tries < 40000; tries++) {
    const x = (Math.random() * 2 - 1) * L0
    const r = radius(x) * Math.sqrt(Math.random())
    const a = Math.random() * Math.PI * 2
    const [bz, by] = bend(x)
    const v = new THREE.Vector3(x, by + Math.sin(a) * r * 0.62, bz + Math.cos(a) * r)
    if (picked.some((p) => p.v.distanceToSquared(v) < MIN_D * MIN_D)) continue
    picked.push({ v })
  }
  picked.forEach((p) => (p.v.x -= 0.75)) // 머리가 화면 밖으로 잘리지 않게 떼 전체를 꼬리 쪽으로
  const fishData = picked.map(({ v }) => ({
    slot: v,
    rad: 0.5 + Math.random() * 1.8,
    ph: Math.random() * Math.PI * 2,
    sp: (0.35 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1),
    yo: (Math.random() - 0.5) * 2.2,
    wob: Math.random() * 6,
    s: 0.32 + Math.random() * 0.08,
  }))
  const school = new THREE.Group()
  school.add(fish)
  school.rotation.y = -0.45
  marks[0].add(school)
  const dummy = new THREE.Object3D()

  // ═════════ 해저 지형: 대륙붕 → 계단식 사면 → 심해 평원 ═════════
  // 소나 셰이더: 음파가 지나간 자리에 등고선이 남는다 (지형·바위 공용)
  const sonarU = {
    uSonar: { value: new THREE.Vector3() },
    uRad: { value: 99 },
    uReveal: { value: 0 },
    uCol: { value: new THREE.Color('#5ce1ff') },
  }
  const sonarize = (mat) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, sonarU)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform vec3 uSonar; uniform float uRad; uniform float uReveal; uniform vec3 uCol;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float sd = distance(vWPos, uSonar);
          float fade = smoothstep(44.0, 22.0, uRad);
          float front = smoothstep(0.55, 0.0, abs(sd - uRad)) * fade;
          float trail = step(sd, uRad) * exp(-(uRad - sd) * 0.3) * fade; // 지나간 자리에 남는 잔광
          float seen = smoothstep(uReveal, uReveal - 5.0, sd);
          float cy = vWPos.y * 0.75;
          float contour = 1.0 - min(abs(fract(cy - 0.5) - 0.5) / fwidth(cy), 1.0);
          totalEmissiveRadiance += uCol * (front * 1.2 + trail * 0.18 + seen * (contour * 0.6 + 0.03));`,
        )
    }
    mat.customProgramCacheKey = () => 'sonar'
  }

  const TZ0 = 24
  const TZ1 = -180
  const terrGeo = new THREE.PlaneGeometry(140, TZ0 - TZ1, 380, 600)
  terrGeo.rotateX(-Math.PI / 2)
  terrGeo.translate(0, 0, (TZ0 + TZ1) / 2)
  const tp = terrGeo.attributes.position
  for (let i = 0; i < tp.count; i++) tp.setY(i, terrainH(tp.getX(i), tp.getZ(i)))
  terrGeo.computeVertexNormals()
  const tn = terrGeo.attributes.normal
  const tcol = new Float32Array(tp.count * 3)
  const sand = new THREE.Color('#5d6663')
  const rockC = new THREE.Color('#2a3138')
  const c = new THREE.Color()
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i)
    const y = tp.getY(i)
    const z = tp.getZ(i)
    const steep = THREE.MathUtils.smoothstep(1 - tn.getY(i), 0.12, 0.42)
    c.copy(sand).lerp(rockC, steep)
    const strata = 0.82 + 0.18 * Math.sin(y * 2.6 + fbm(x * 0.3, 3, z * 0.3) * 2.5) // 절벽면 지층
    c.multiplyScalar(THREE.MathUtils.lerp(1, strata, steep) * (0.85 + fbm(x * 0.4, 9, z * 0.4) * 0.3))
    c.toArray(tcol, i * 3)
  }
  terrGeo.setAttribute('color', new THREE.BufferAttribute(tcol, 3))
  const terrMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, envMapIntensity: 0.35 })
  sonarize(terrMat)
  const terrain = new THREE.Mesh(terrGeo, terrMat)
  scene.add(terrain)

  // 흩어진 바위: 절벽 아래와 평탄면에. 카메라 동선(x≈0)은 비운다.
  const rockMat = new THREE.MeshStandardMaterial({ color: '#343c43', roughness: 0.95, metalness: 0, envMapIntensity: 0.35 })
  sonarize(rockMat)
  const rockGeos = [rockGeometry(1.3, [1, 0.62, 1.1]), rockGeometry(4.1, [1.2, 0.7, 0.9], 0.5), rockGeometry(6.6, [0.9, 0.8, 1])]
  const rnd = (a, b) => a + Math.random() * (b - a)
  rockGeos.forEach((g) => {
    const N = 90
    const im = new THREE.InstancedMesh(g, rockMat, N)
    let n = 0
    while (n < N) {
      const x = rnd(-46, 46)
      const z = rnd(TZ0 - 6, TZ1 + 6)
      if (Math.abs(x) < 3.2 || Math.hypot(x, z - LANDMARK_Z[1]) < 32 || Math.hypot(x - 0.5, z - LANDMARK_Z[3]) < 9 || Math.hypot(x, z - LANDMARK_Z[4]) < 9) continue
      const slope = Math.abs(terrainH(x, z + 0.6) - terrainH(x, z - 0.6))
      if (slope < 0.4 && Math.random() < 0.55) continue
      const s = rnd(0.35, 1.0) * (slope > 0.6 ? 1.9 : 1)
      dummy.position.set(x, terrainH(x, z) - s * 0.25, z)
      dummy.rotation.set(rnd(-0.3, 0.3), rnd(0, 6.28), rnd(-0.3, 0.3))
      dummy.scale.set(s * rnd(0.8, 1.4), s * rnd(0.6, 1.1), s * rnd(0.8, 1.4))
      dummy.updateMatrix()
      im.setMatrixAt(n++, dummy.matrix)
    }
    scene.add(im)
  })

  // 2) −200m 소나 — 음파가 지형을 훑어 등고선을 그리고, 암초 사이 길목이 이어진다 (AI에게 맡기기 전에 규칙부터)
  const RY = LANDMARK_Y[1]
  const RZ = LANDMARK_Z[1]
  const floorAt = (x, z) => terrainH(x, z + RZ) - RY // 랜드마크 로컬 기준 바닥 높이
  const reef = new THREE.Group()
  const routePts = []
  for (let i = 0; i <= 90; i++) {
    const z = 9 - i * 0.34
    routePts.push(new THREE.Vector3(channelX(z), floorAt(channelX(z), z) + 0.14, z))
  }
  const route = new THREE.CatmullRomCurve3(routePts)
  const routeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uProg: { value: 0 }, uTime: timeU, uCol: { value: new THREE.Color('#9ff4ff') } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uProg; uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
      void main() {
        float dash = step(0.45, fract(vUv.x * 130.0 - uTime * 1.2));
        float a = step(vUv.x, uProg) * dash * 0.8;
        gl_FragColor = vec4(uCol * a, a);
        #include <colorspace_fragment>
      }`,
  })
  reef.add(new THREE.Mesh(new THREE.TubeGeometry(route, 500, 0.12, 8), routeMat))
  const emitter = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#7fe9ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
  emitter.position.set(channelX(9), floorAt(channelX(9), 9) + 0.6, 9)
  emitter.scale.setScalar(3.6)
  reef.add(emitter)
  marks[1].add(reef)

  // 3) −1,000m 해저 탐사선 — 소나가 그린 경로 끝에서 대기하다 조명을 켜고 출발 (처음 쓰는 도구도 결과로)
  const rov = makeROV(glow)
  scene.add(rov.group)
  // 탐사선 경로(월드 좌표): 아래 단을 가로질러 절벽 끝까지 → 절벽을 내려가 침몰선 앞에서 멈춘다
  const rovCurve = new THREE.CatmullRomCurve3(
    [
      [-0.5, -47.8, -84.5],
      [0.2, -48.2, -89],
      [0.6, -48.4, -93],
      [0.5, -48.2, -97.5],
      [0.6, -51.2, -101],
      [1.2, -54.6, -105.5],
      [1.6, -57.2, -109.6],
    ].map((p) => new THREE.Vector3(...p)),
  )
  const rovP = new THREE.Vector3()
  const rovT = new THREE.Vector3()
  const rovLook = new THREE.Vector3()
  let lightT = 0 // 3단계 도착 후 흐른 시간(조명 점등 연출)

  // 4) −2,400m 침몰선 — 레이저 스캔으로 디지털 트윈을 만들고, 어긋남을 줄여 맞춘다 (센티미터 단위까지)
  // 배는 두 동강: 앞부분(선수)은 여기, 뒷부분(선미)은 다음 절벽 아래 심해 평원(5단계)에
  const WRECK_S = 1.5 // 난파선 크기 배율 (보물상자·잠수정에 비해 충분히 크게)
  const placeWreck = (wk, ry, rx, rz, cx, cz, sink) => {
    const g = wk.group
    g.rotation.set(rx, ry, rz, 'YXZ')
    g.scale.setScalar(WRECK_S)
    const mid = ((wk.x0 + wk.x1) / 2) * WRECK_S // 이 반쪽의 가운데가 (cx, cz)에 오게
    const px = cx - mid * Math.cos(ry)
    const pz = cz + mid * Math.sin(ry)
    let floor = Infinity
    for (let x = wk.x0 * WRECK_S; x <= wk.x1 * WRECK_S; x += 1) floor = Math.min(floor, terrainH(px + x * Math.cos(ry), pz - x * Math.sin(ry)))
    g.position.set(px, 0, pz)
    // 기울어진 뒤의 실제 가장 낮은 점이 바닥보다 sink만큼 묻히게
    g.rotation.order = 'YXZ' // 요(방향) → 롤(옆으로 눕기, 배의 길이축 x) → 피치 순서
    g.updateMatrixWorld(true)
    const low = new THREE.Box3().setFromObject(wk.mesh).min.y
    g.position.y = floor - sink * WRECK_S - low
    scene.add(g)
  }
  const wreck = makeWreck(BREAK_X, 7)
  // 배 전체(없는 뒷부분 포함)의 가운데가 화면 가운데 오도록 앞부분을 뱃머리 쪽으로 옮겨 놓는다
  const WRY = -0.85 // 뱃머리는 오른쪽 앞(카메라 쪽), 없는 뒷부분은 왼쪽 안쪽으로 뻗는다
  placeWreck(wreck, WRY, 0.48, 0.06, 1.0 + 4.5 * Math.cos(WRY), LANDMARK_Z[3] - 1.8 - 4.5 * Math.sin(WRY), 0.55) // 옆으로 크게 누워(갑판이 카메라 쪽) 반쯤 묻혀 있다
  wreck.group.updateMatrixWorld()
  const wreckC = wreck.group.localToWorld(new THREE.Vector3(3, 1, 0))
  const label = makeLabel()
  label.sprite.position.set(1.2, 4.6, 0.6)
  label.sprite.scale.divideScalar(WRECK_S)
  wreck.group.add(label.sprite)
  disposables.push(label.tex)
  // 없는 뒷부분 표시
  const lostLabel = makeLabel('rgba(255,110,110,0.9)', '#ffd6d6')
  lostLabel.sprite.position.set(-2.6, 4.2, 0.6) // 부러진 자리 바로 뒤: 모바일 세로 화면에서도 안에 들어오게
  lostLabel.sprite.scale.divideScalar(WRECK_S)
  lostLabel.set('MISSING', 'STERN SECTION')
  wreck.group.add(lostLabel.sprite)
  disposables.push(lostLabel.tex)
  // 탐사선에서 스캔 띠로 뻗는 레이저 부채꼴
  const fanGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3))
  const fanMat = new THREE.MeshBasicMaterial({ color: '#5ce1ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
  const fan = new THREE.Mesh(fanGeo, fanMat)
  fan.frustumCulled = false
  scene.add(fan)
  const fanA = new THREE.Vector3()
  const fanB = new THREE.Vector3()
  const fanO = new THREE.Vector3()
  let scanT = 0 // 4단계 도착 후 흐른 시간

  // 카메라 따라가기용
  const fCam = new THREE.Vector3()
  const fLook = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const mFollow = new THREE.Matrix4()
  const qFollow = new THREE.Quaternion()
  const UP = new THREE.Vector3(0, 1, 0)

  // 5) −4,000m 인양 — 부러진 선미에서 보물상자를 찾아 인양 풍선에 매달아 수면까지 (아니라면 접고, 배운 것으로 다시)
  const stern = makeWreck(-7, BREAK_X)
  stern.twin.visible = false
  placeWreck(stern, -0.55, 0.08, -0.12, -1.2, LANDMARK_Z[4] - 3, 0.9)
  // 탐사선 두 번째 경로: 선수 위에서 출발해 마지막 절벽을 내려가 상자 옆에 멈춘다
  const rovCurve2 = new THREE.CatmullRomCurve3(
    [
      [1.6, -57.2, -109.6],
      [1.4, -58.6, -114],
      [1.2, -60, -119],
      [1.0, -63, -123.5],
      [1.3, -69, -127.5],
      [1.4, -74.5, -132.5],
      [0.6, -77.4, -137.5],
      [-0.7, -78.3, -141.0],
    ].map((p) => new THREE.Vector3(...p)),
  )
  const chest = makeChest(glow)
  const chestRest = new THREE.Vector3(LIFT.x, terrainH(LIFT.x, LIFT.z) - 0.1, LIFT.z)
  chest.group.position.copy(chestRest)
  scene.add(chest.group)
  const handle = [new THREE.Vector3(), new THREE.Vector3()]
  const bag = makeLiftBag()
  scene.add(bag.group)
  const rope = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)), new THREE.LineBasicMaterial({ color: '#c9b98a' }))
  rope.frustumCulled = false
  scene.add(rope)
  // 기포: 공기를 채울 때는 탐사선 팔 → 풍선 입구로, 올라갈 때는 풍선 아래로 꼬리
  const BUB_N = 90
  const bubGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(BUB_N * 3), 3))
  const bubMat = new THREE.PointsMaterial({ map: glow, color: '#dff7ff', size: 0.16, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  const bubbles = new THREE.Points(bubGeo, bubMat)
  bubbles.frustumCulled = false
  scene.add(bubbles)
  const bubJ = Array.from({ length: BUB_N }, () => [Math.random() - 0.5, Math.random() - 0.5, Math.random(), 0.6 + Math.random() * 0.8])
  const armTip = new THREE.Vector3()
  const mouth = new THREE.Vector3()
  let liftT = 0 // 5단계 도착 후 흐른 시간

  // ═════════ 프레임 ═════════
  let w = 1
  let h = 1
  const fogC = new THREE.Color()
  const clock = new THREE.Clock()

  function resize(width, height) {
    w = width
    h = height
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = (timeU.value += dt)

    // 카메라
    const D = S.dist * S.far
    const camY = S.y + S.my * 0.25 + Math.sin(S.look) * D
    const camZ = S.z + Math.cos(S.look) * D
    camera.position.set(S.camX + S.mx * 0.35, camY, camZ)
    camera.rotation.set(S.pitch - S.look - S.my * 0.02, S.mx * 0.03, 0)

    // 탐사선
    const c2 = S.rov2 > 0
    const curve = c2 ? rovCurve2 : rovCurve
    curve.getPointAt(c2 ? S.rov2 : S.rov, rovP)
    curve.getTangentAt(c2 ? S.rov2 : S.rov, rovT)
    rov.group.position.copy(rovP)
    rov.group.position.y += Math.sin(t * 0.9) * 0.05
    rovLook.copy(rovP).add(rovT.setY(rovT.y * 0.5))
    // 3단계에서는 카메라 쪽으로 비스듬히 서서 조명을 켜고, 출발하면서 진행 방향으로 돈다
    const turn = 1 - THREE.MathUtils.smoothstep(S.rov, 0.0, 0.14)
    if (turn > 0) rovLook.lerp(fLook.set(rovP.x + 0.85, rovP.y - 0.15, rovP.z + 0.55), turn)
    if (!c2 && S.rov > 0.85) rovLook.lerp(fCam.set(wreckC.x, rovP.y - 1.4, wreckC.z), THREE.MathUtils.smoothstep(S.rov, 0.85, 1)) // 마지막엔 침몰선 쪽으로 머리를 살짝 숙인다
    if (c2 && S.rov2 > 0.85) rovLook.lerp(fCam.set(chestRest.x, rovP.y - 0.9, chestRest.z), THREE.MathUtils.smoothstep(S.rov2, 0.85, 1)) // 상자를 바라본다
    rov.group.lookAt(rovLook)
    rov.group.rotateZ(Math.sin(t * 0.7) * 0.03)

    // 따라가기: 탐사선 뒤 위에서 진행 방향 앞쪽을 본다
    if (S.follow > 0) {
      fwd.copy(rovT).setY(0).normalize()
      fCam.copy(rovP).addScaledVector(fwd, -11)
      fCam.y += 4.4
      fLook.copy(rovP).addScaledVector(fwd, 7)
      fLook.y -= 3
      mFollow.lookAt(fCam, fLook, UP)
      qFollow.setFromRotationMatrix(mFollow)
      camera.position.lerp(fCam, S.follow)
      camera.quaternion.slerp(qFollow, S.follow)
    }
    // 인양 상승 중: 풍선과 상자를 화면 가운데 두고 같이 올라간다 (위치는 직전 프레임 값)
    const lw = THREE.MathUtils.smoothstep(S.lift, 0, 0.08) * (1 - THREE.MathUtils.smoothstep(S.lift, 0.82, 1))
    if (lw > 0) {
      fLook.set(mouth.x, mouth.y - 0.4, mouth.z)
      fCam.set(mouth.x - 0.9, mouth.y + 0.2, mouth.z + S.dist * 1.05)
      mFollow.lookAt(fCam, fLook, UP)
      qFollow.setFromRotationMatrix(mFollow)
      camera.position.lerp(fCam, lw)
      camera.quaternion.slerp(qFollow, lw)
    }
    const fw = Math.max(S.follow, lw)
    camera.setViewOffset(w, h, -S.shiftX * w * (1 - fw), S.shiftY * h * (1 - fw), w, h)
    const fy = camera.position.y
    const fz = camera.position.z

    const under = fy < waveH(camera.position.x, camera.position.z, t) - 0.02
    const wy = Math.min(fy, THREE.MathUtils.lerp(THREE.MathUtils.lerp(S.y, rovP.y, S.follow), mouth.y, lw)) // 높이 떠서 내려다볼 때도 물빛·조명은 바라보는 지점 수심 기준
    const fogD = waterAt(wy, fogC)
    const k = 8 / (S.dist * Math.pow(Math.max(1, S.far), 0.7)) // 화면이 세로로 길어 카메라가 멀어지면 안개를 덜 짙게
    if (under) {
      scene.background = fogC
      scene.fog.color.copy(fogC)
      scene.fog.density = fogD * k
      sky.visible = false
    } else {
      scene.background = null
      scene.fog.color.set('#123c63')
      scene.fog.density = 0.012
      sky.visible = true
    }
    surfMat.uniforms.uFog.value.copy(fogC)
    surfMat.uniforms.uFogD.value = fogD * k * 0.55

    const depth01 = THREE.MathUtils.clamp(-wy / 78, 0, 1)
    hemi.intensity = under ? THREE.MathUtils.lerp(1.4, 0.12, Math.pow(depth01, 0.6)) : 1.0
    moon.intensity = under ? THREE.MathUtils.lerp(1.2, 0, Math.pow(depth01, 0.4)) : 1.6
    scene.environmentIntensity = under ? THREE.MathUtils.lerp(1.0, 0.25, depth01) : 0.9
    torch.intensity = under ? THREE.MathUtils.lerp(2, 26, depth01) : 0
    torch.position.set(camera.position.x + 1.5, fy + 1.2, fz - 1.5)
    rays.position.z = fz - 8
    rim.intensity = under ? THREE.MathUtils.lerp(0, 1.6, THREE.MathUtils.smoothstep(depth01, 0.3, 1)) : 0
    rayMat.uniforms.uOpacity.value = under ? 1 - THREE.MathUtils.smoothstep(-wy, 6, 32) : 0

    // 부표
    const bh = waveH(BUOY.x, BUOY.z, t)
    const [sx, sz] = waveSlope(BUOY.x, BUOY.z, t)
    buoy.position.y = bh - 0.08
    buoy.rotation.set(sz * 0.7, t * 0.05, -sx * 0.7)
    const blink = Math.pow(0.5 + 0.5 * Math.sin(t * 2.2), 6)
    beaconHalo.material.opacity = 0.35 + blink * 0.65
    beaconLight.intensity = 1 + blink * 5
    pulses.forEach((p, i) => {
      const u = (t * 0.035 + i / pulses.length) % 1
      cableCurve.getPointAt(u, p.position)
      p.visible = under
    })

    // 가까운 랜드마크만 그린다
    marks.forEach((m, i) => (m.visible = under && Math.hypot(fy - LANDMARK_Y[i], fz - LANDMARK_Z[i]) < 48))

    // 1) 정어리: 제각각 → 대열
    if (marks[0].visible) {
      const p = THREE.MathUtils.smoothstep(L[0], 0.1, 0.65)
      const part = 1 - THREE.MathUtils.smoothstep(camZ, 1.5, 6.5) // 카메라가 다가가면 떼가 좌우로 갈라진다
      for (let i = 0; i < FISH_N; i++) {
        const f = fishData[i]
        const a = f.ph + t * f.sp
        const dir = Math.sign(f.sp)
        const cx = Math.cos(a) * f.rad
        const cz = Math.sin(a) * f.rad * 0.6
        const cy = f.yo + Math.sin(a * 2 + f.wob) * 0.3
        const yawC = Math.atan2(-Math.cos(a) * 0.6 * dir, -Math.sin(a) * dir)
        const sy = f.slot.y + Math.sin(t * 1.3 + f.slot.x * 1.4) * 0.06
        dummy.position.set(THREE.MathUtils.lerp(cx, f.slot.x, p), THREE.MathUtils.lerp(cy, sy, p), THREE.MathUtils.lerp(cz, f.slot.z, p))
        if (part > 0) {
          dummy.position.x += (dummy.position.x >= 0 ? 1 : -1) * part * (3.2 + f.wob * 0.3)
          dummy.position.y += part * f.slot.y * 1.2
        }
        const d = Math.atan2(Math.sin(-yawC), Math.cos(-yawC))
        dummy.rotation.set(0, yawC + d * p, Math.sin(t * 2 + f.wob) * 0.06)
        dummy.scale.setScalar(f.s)
        dummy.updateMatrix()
        fish.setMatrixAt(i, dummy.matrix)
      }
      fish.instanceMatrix.needsUpdate = true
      school.rotation.y = -0.45 + Math.sin(t * 0.15) * 0.08
    }

    // 2) 소나: 음파가 지형을 훑고, 길목을 따라 경로가 이어짐
    if (marks[1].visible) {
      const r = (t * 8) % 44
      emitter.getWorldPosition(sonarU.uSonar.value)
      sonarU.uRad.value = r
      // 단계 정지점(L≈0.58)에 닿기 전에 등고선·경로가 끝까지 다 그려지도록
      sonarU.uReveal.value = THREE.MathUtils.smoothstep(L[1], 0.0, 0.45) * 40
      routeMat.uniforms.uProg.value = THREE.MathUtils.smoothstep(L[1], 0.08, 0.52)
      emitter.material.opacity = 0.6 + 0.4 * Math.sin(t * 4)
    } else {
      sonarU.uRad.value = 99
      sonarU.uReveal.value = 0
    }

    // 3) 탐사선: 도착하면 조명이 깜빡이며 켜진다. 이후로는 계속 켜져 있다.
    const rovVis = under && (marks[2].visible || marks[3].visible || marks[4].visible)
    rov.group.visible = rovVis
    lightT = L[2] > 0.01 ? lightT + dt : 0
    const flick = lightT < 0.25 ? 0 : lightT < 0.9 ? (Math.sin(lightT * 47) > 0.1 ? 1 : 0.15) : 1
    rov.setLights(rovVis ? flick * THREE.MathUtils.smoothstep(lightT, 0.25, 1.2) : 0)
    rov.prop.rotation.z += dt * (3 + S.follow * 14)
    rov.status.material.color.setHSL(0.38, 1, 0.45 + 0.3 * Math.max(0, Math.sin(t * 4)))

    // 4) 침몰선: 레이저가 선수→선미로 훑으며 트윈을 그리고, 어긋난 트윈이 실제 배에 맞춰진다
    wreck.group.visible = under && marks[3].visible
    scanT = L[3] > 0.01 ? scanT + dt : 0
    if (wreck.group.visible) {
      const reveal = THREE.MathUtils.smoothstep(scanT, 0.2, 2.4)
      const err = 1 - THREE.MathUtils.smoothstep(scanT, 2.0, 4.6)
      const sx0 = (wreck.ghost ? -7 : wreck.x0) - 0.4 // 없는 뒷부분 자리까지 훑는다
      const sx1 = wreck.x1 + 0.4
      const scanX = reveal < 1 ? THREE.MathUtils.lerp(sx1, sx0, reveal) : sx1 - ((scanT - 2.4) * 3.2) % (sx1 - sx0)
      wreck.scanU.uScan.value = scanX
      wreck.scanU.uScanOn.value = THREE.MathUtils.smoothstep(scanT, 0.1, 0.4)
      wreck.twinMat.uniforms.uReveal.value = reveal < 1 ? scanX : -99 // 트윈은 선수(+x)부터 스캔된 만큼 보인다
      wreck.twinMat.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(scanT, 0.2, 0.6) * (0.4 + 0.25 * (1 - err))
      wreck.twin.position.set(0.7 * err, 0.85 * err + Math.sin(t * 2.1) * 0.03 * err, -0.5 * err)
      wreck.twin.rotation.set(0.05 * err, 0.16 * err, -0.06 * err)
      wreck.twin.visible = reveal > 0
      label.sprite.material.opacity = THREE.MathUtils.smoothstep(scanT, 1.6, 2.2)
      // 빨간 뒷부분: 스캔이 부러진 자리를 지나면 나타나 희미하게 깜빡인다
      if (camera.aspect < 0.8) lostLabel.sprite.position.set(-0.6, 5.4, 0.6) // 세로 화면: 왼쪽 끝에서 잘리지 않게 배 가운데 쪽 위로
      wreck.ghostMat.uniforms.uReveal.value = reveal < 1 ? scanX : -99
      wreck.ghostMat.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(scanT, 0.2, 0.6) * (0.55 + 0.15 * Math.sin(t * 5))
      lostLabel.sprite.material.opacity = (reveal < 1 ? 1 - THREE.MathUtils.smoothstep(scanX, wreck.x0 - 3.5, wreck.x0 - 1.5) : 1) * (0.75 + 0.25 * Math.sin(t * 5))
      label.set('ALIGNING', 'SCAN ↔ TWIN') // 실측 기록이 없는 수치는 쓰지 않는다: 숫자 없이 트윈이 맞춰지는 연출만
      // 레이저 부채꼴: 탐사선 앞 → 스캔 띠 위·아래
      const deckH = 2.4
      fanA.set(scanX, deckH + 0.3, 1.7)
      fanB.set(scanX, 0.6, 1.7)
      wreck.group.localToWorld(fanA)
      wreck.group.localToWorld(fanB)
      fanO.set(0, 0.02, 1.25)
      rov.group.localToWorld(fanO)
      const fp = fanGeo.attributes.position
      fp.setXYZ(0, fanO.x, fanO.y, fanO.z)
      fp.setXYZ(1, fanA.x, fanA.y, fanA.z)
      fp.setXYZ(2, fanB.x, fanB.y, fanB.z)
      fp.needsUpdate = true
      fanMat.opacity = wreck.scanU.uScanOn.value * 0.12 * THREE.MathUtils.smoothstep(S.rov, 0.95, 1) * (1 - THREE.MathUtils.smoothstep(S.rov2, 0, 0.08))
    } else {
      fanMat.opacity = 0
    }

    // 5) 인양: 도착하면 상자가 빛나고, 탐사선이 풍선에 공기를 채우고, 상자가 들리고, 스크롤하면 수면까지 떠오른다
    stern.group.visible = under && marks[4].visible
    const liftVis = marks[4].visible || S.lift > 0
    chest.group.visible = bag.group.visible = rope.visible = bubbles.visible = liftVis
    liftT = L[4] > 0.01 ? liftT + dt : 0
    if (liftVis) {
      const a = S.lift
      // 5단계를 빨리 지나쳐도 떠오를 때는 다 부풀어 있게
      const inflate = Math.max(THREE.MathUtils.smoothstep(liftT, 0.6, 3.2), THREE.MathUtils.smoothstep(a, 0, 0.12))
      const taut = Math.max(THREE.MathUtils.smoothstep(liftT, 2.9, 3.9), THREE.MathUtils.smoothstep(a, 0.04, 0.16))
      // mouth = 풍선 아래 고리(밧줄이 모이는 곳). 상자 손잡이 높이 0.52
      const mouth0 = chestRest.y + 0.52 + 0.3 + 1.0 * inflate + 0.35 * taut
      // 상승 경로: 먼저 곧장 떠오르고(v), 뒤따라 수평으로 부표 쪽으로 흘러간다(hz). 지형보다 항상 위 (경로 검증함)
      const v = THREE.MathUtils.smoothstep(a, 0, 0.55) * 0.85 + THREE.MathUtils.smoothstep(a, 0.55, 1) * 0.15
      const hz = THREE.MathUtils.smoothstep(a, 0.12, 0.97)
      const lx = THREE.MathUtils.lerp(LIFT.x, SURF.x, hz)
      const lz = THREE.MathUtils.lerp(LIFT.z, SURF.z, hz)
      const top = waveH(lx, lz, t) - 2.25 // 수면에서는 풍선 돔 꼭대기만 물 밖으로
      const rise = (top - mouth0) * v
      const sway = Math.sin(t * 0.8) * (0.05 + a * 0.12)
      mouth.set(lx + sway, mouth0 + rise, lz)
      bag.group.position.copy(mouth)
      bag.group.scale.set(0.5 + 0.5 * inflate, 0.22 + 0.78 * inflate + Math.sin(t * 2.3) * 0.01, 0.5 + 0.5 * inflate)
      bag.group.rotation.set(0, t * 0.05, (1 - inflate) * 0.9 + sway * 0.3) // 처음엔 납작하게 누워 있다
      const cg = chest.group
      cg.position.set(lx + sway * 1.4, chestRest.y + 0.35 * taut + rise, lz)
      cg.rotation.set(0.22 * (1 - taut), -0.5, 0.18 * (1 - taut) - sway * 0.4) // 모래에 기울어 묻혀 있다가 들리면 수평으로
      const glowAmt = Math.max(THREE.MathUtils.smoothstep(liftT, 0.1, 1.0), THREE.MathUtils.smoothstep(a, 0, 0.05)) // 도착하면 닫힌 뚜껑 틈으로 금빛이 샌다
      chest.setOpen(glowAmt, 0.8 + 0.2 * Math.sin(t * 3))
      cg.updateMatrixWorld()
      cg.localToWorld(handle[0].set(-0.47, 0.36, 0))
      cg.localToWorld(handle[1].set(0.47, 0.36, 0))
      const rp = rope.geometry.attributes.position
      rp.setXYZ(0, mouth.x, mouth.y + 0.02, mouth.z)
      rp.setXYZ(1, handle[0].x, handle[0].y, handle[0].z)
      rp.setXYZ(2, mouth.x, mouth.y + 0.02, mouth.z)
      rp.setXYZ(3, handle[1].x, handle[1].y, handle[1].z)
      rp.needsUpdate = true
      // 기포
      const bp = bubGeo.attributes.position
      const filling = a < 0.02 && inflate > 0.01 && inflate < 0.99
      if (filling) rov.group.localToWorld(armTip.set(0.22, -0.55, 1.25))
      for (let i = 0; i < BUB_N; i++) {
        const [jx, jz, ph, sp] = bubJ[i]
        const u = (t * 0.7 * sp + ph) % 1
        if (filling) {
          bp.setXYZ(i, THREE.MathUtils.lerp(armTip.x, mouth.x, u) + jx * 0.15, THREE.MathUtils.lerp(armTip.y, mouth.y + 0.5, u) + Math.sin(u * 3.14) * 0.6, THREE.MathUtils.lerp(armTip.z, mouth.z, u) + jz * 0.15)
        } else {
          bp.setXYZ(i, mouth.x + jx * (0.3 + u * 0.8), mouth.y - u * 7 * Math.min(1, a * 8), mouth.z + jz * (0.3 + u * 0.8))
        }
      }
      bp.needsUpdate = true
      bubMat.opacity = filling ? 0.85 : 0.8 * THREE.MathUtils.smoothstep(a, 0.0, 0.08) * (1 - THREE.MathUtils.smoothstep(a, 0.9, 1))
    }

    renderer.render(scene, camera)
  }

  function dispose() {
    scene.traverse((o) => {
      o.geometry?.dispose()
      const m = o.material
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose())
    })
    scene.environment?.dispose()
    disposables.forEach((d) => d.dispose())
    renderer.dispose()
  }

  return { S, L, resize, tick, dispose, renderer }
}
