import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ─────────────────────────────────────────────────────────────
// 해양 생물·오브젝트 절차적 모델링 도구
//   bodyGeometry  단면(초타원)을 길이 방향으로 이어 붙인 몸통. 머리 = +x
//   addSwim       꼬리 쪽일수록 크게 휘는 헤엄 셰이더 (onBeforeCompile)
//   fbm           바위·피부 질감용 값 노이즈
// ─────────────────────────────────────────────────────────────

function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return h - Math.floor(h)
}
function vnoise(x, y, z) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const w = zf * zf * (3 - 2 * zf)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  )
}
export function fbm(x, y, z, oct = 4) {
  let a = 0.5
  let f = 1
  let s = 0
  for (let i = 0; i < oct; i++) {
    s += a * (vnoise(x * f, y * f, z * f) * 2 - 1)
    f *= 2.03
    a *= 0.5
  }
  return s
}

// profile(t) → { h, w, y?, n? }  t: 0 = 코끝, 1 = 꼬리 끝
export function bodyGeometry(profile, { length = 1, seg = 48, rad = 24 } = {}) {
  const pos = []
  const uv = []
  const idx = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const p = profile(t)
    const n = p.n ?? 2
    const X = (0.5 - t) * length
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2
      const c = Math.cos(a)
      const s = Math.sin(a)
      const cy = Math.sign(s) * Math.pow(Math.abs(s), 2 / n)
      const cz = Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
      pos.push(X, (p.y ?? 0) + cy * p.h, cz * p.w)
      uv.push(t, j / rad)
    }
  }
  const row = rad + 1
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rad; j++) {
      const a = i * row + j
      const b = a + row
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// 지오메트리에 정점 색 칠하기 (fn(x, y, z, out:Color))
export function paint(g, fn) {
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), c)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// 서로 다른 지오메트리를 합치기 전에 속성을 맞춘다 (position/normal/uv/color, 모두 index 있음)
function unify(g, color) {
  if (!g.index) {
    const n = g.attributes.position.count
    g.setIndex([...Array(n).keys()])
  }
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  if (!g.attributes.color) paint(g, (x, y, z, c) => c.copy(color))
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k)
  return g
}
export function merge(parts) {
  return mergeGeometries(parts.map(([g, color]) => unify(g, color)))
}

export function finShape(points) {
  const s = new THREE.Shape()
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return new THREE.ShapeGeometry(s, 8)
}

// 헤엄 셰이더: 머리(+x)에서 꼬리(-x)로 갈수록 크게 휘는 파동.
//   axis 'z' = 좌우(물고기), 'y' = 상하(고래)
export function addSwim(mat, { time, axis = 'z', from = 0.2, span = 1, freq = 8, wave = 6, amp = 0.08, instanced = false }) {
  const uniforms = { uSwimAmp: { value: amp }, uSwimPhase: { value: 0 }, uTime: time }
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime; uniform float uSwimAmp; uniform float uSwimPhase;
        ${instanced ? 'attribute float aPhase;' : ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float tl = clamp((${from.toFixed(3)} - position.x) / ${span.toFixed(3)}, 0.0, 1.0);
        float ph = ${instanced ? 'aPhase' : 'uSwimPhase'};
        transformed.${axis} += sin(uTime * ${freq.toFixed(3)} + ph - tl * ${wave.toFixed(3)}) * uSwimAmp * (0.15 + tl * tl);`,
      )
  }
  mat.customProgramCacheKey = () => `swim-${axis}-${from}-${span}-${freq}-${wave}-${instanced}`
  return uniforms
}

// ── 정어리 ── 길이 1, 머리 +x
export function sardineGeometry() {
  const body = bodyGeometry(
    (t) => {
      const b = Math.min(t / 0.86, 1)
      const h = 0.1 * Math.pow(Math.sin(Math.PI * Math.pow(b, 0.72)), 0.85) + 0.012
      return { h, w: h * 0.48, y: -0.004 * Math.sin(Math.PI * b) }
    },
    { seg: 40, rad: 14 },
  )
  const back = new THREE.Color('#1d5a7d')
  const stripe = new THREE.Color('#7fd6e8')
  const belly = new THREE.Color('#e8f1f5')
  paint(body, (x, y, z, c) => {
    const k = THREE.MathUtils.smoothstep(y, -0.02, 0.05)
    c.copy(belly).lerp(back, k)
    const st = Math.exp(-Math.pow((y - 0.012) / 0.008, 2)) * 0.45
    c.lerp(stripe, st)
  })
  const tail = finShape([[-0.34, 0.016], [-0.55, 0.12], [-0.49, 0.0], [-0.55, -0.12], [-0.34, -0.016]])
  const dorsal = finShape([[0.06, 0.095], [-0.1, 0.085], [-0.05, 0.16]])
  const eyeL = new THREE.SphereGeometry(0.017, 8, 6).translate(0.39, 0.018, 0.028)
  const eyeR = new THREE.SphereGeometry(0.017, 8, 6).translate(0.39, 0.018, -0.028)
  const finC = new THREE.Color('#5a8fa8')
  return merge([
    [body],
    [tail, finC],
    [dorsal, finC],
    [eyeL, new THREE.Color('#05080c')],
    [eyeR, new THREE.Color('#05080c')],
  ])
}

// ── 초롱아귀 ── 길이 약 2.2, 머리 +x. { group, lure, light, jaw, swim }
export function makeAngler(time, glow) {
  const group = new THREE.Group()
  const L = 2.2
  const body = bodyGeometry(
    (t) => {
      const head = THREE.MathUtils.smoothstep(t, 0, 0.16)
      const tail = Math.pow(THREE.MathUtils.clamp((t - 0.2) / 0.8, 0, 1), 1.25)
      const h = (0.42 + 0.3 * head) * (1 - tail * 0.9) + 0.03
      return { h, w: h * 0.82, y: 0.06 * (1 - t) }
    },
    { length: L, seg: 56, rad: 32 },
  )
  // 울퉁불퉁한 피부
  const p = body.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const r = Math.hypot(v.y, v.z) || 1
    const d = fbm(v.x * 3, v.y * 3, v.z * 3) * 0.06 * r
    p.setY(i, v.y + (v.y / r) * d)
    p.setZ(i, v.z + (v.z / r) * d)
  }
  body.computeVertexNormals()
  const dark = new THREE.Color('#1c1714')
  const mid = new THREE.Color('#4a3c33')
  paint(body, (x, y, z, c) => {
    const n = fbm(x * 4 + 3, y * 4, z * 4) * 0.5 + 0.5
    c.copy(dark).lerp(mid, THREE.MathUtils.clamp(n * 0.9 + (y > 0 ? 0 : 0.15), 0, 1))
  })
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.08 })
  const swim = addSwim(skin, { time, axis: 'z', from: -0.2, span: 1.0, freq: 2.4, wave: 2.5, amp: 0.1 })
  const bodyMesh = new THREE.Mesh(body, skin)
  group.add(bodyMesh)

  // 입: 안쪽 어둠 + 아래로 튀어나온 턱 + 바늘 이빨
  const front = L / 2
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40), new THREE.MeshBasicMaterial({ color: '#0b0203' }))
  mouth.rotation.y = Math.PI / 2
  mouth.scale.set(0.88, 0.5, 1)
  mouth.position.set(front - 0.05, -0.1, 0)
  group.add(mouth)
  const jaw = new THREE.Group()
  jaw.position.set(front - 0.55, -0.2, 0)
  const jawSkin = new THREE.MeshStandardMaterial({ color: '#2e2520', roughness: 0.62, metalness: 0.08 })
  const jawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), jawSkin)
  jawMesh.scale.set(1.0, 0.42, 0.82)
  jawMesh.position.x = 0.12
  jaw.add(jawMesh)
  const toothMat = new THREE.MeshStandardMaterial({ color: '#efe8d8', roughness: 0.25, metalness: 0, emissive: '#3a3226', emissiveIntensity: 0.3 })
  const toothGeo = new THREE.ConeGeometry(0.022, 0.2, 6)
  for (let i = 0; i < 13; i++) {
    const a = THREE.MathUtils.lerp(-1.35, 1.35, i / 12)
    const tooth = new THREE.Mesh(toothGeo, toothMat)
    const len = 0.7 + 0.6 * Math.cos(a * 1.1) * (i % 2 ? 0.6 : 1)
    tooth.scale.set(1, len, 1)
    tooth.position.set(0.12 + Math.cos(a) * 0.6, 0.06, Math.sin(a) * 0.5)
    tooth.rotation.set(0, 0, -0.25 - Math.cos(a) * 0.15)
    jaw.add(tooth)
  }
  group.add(jaw)
  for (let i = 0; i < 9; i++) {
    const a = THREE.MathUtils.lerp(-1.1, 1.1, i / 8)
    const tooth = new THREE.Mesh(toothGeo, toothMat)
    tooth.scale.set(0.8, 0.6 + 0.4 * Math.cos(a), 0.8)
    tooth.position.set(front - 0.08 - (1 - Math.cos(a)) * 0.12, 0.13, Math.sin(a) * 0.38)
    tooth.rotation.set(Math.PI, 0, 0.2)
    group.add(tooth)
  }
  // 눈
  for (const z of [-0.33, 0.33]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: '#0a0d10', roughness: 0.05, metalness: 0.3 }))
    eye.position.set(front - 0.42, 0.3, z * 1.32)
    group.add(eye)
  }
  // 가슴·등·꼬리 지느러미
  const finMat = new THREE.MeshStandardMaterial({ color: '#3a2f29', roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
  const pect = finShape([[0, 0], [-0.28, 0.32], [-0.42, 0.2], [-0.4, -0.05]])
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(pect, finMat)
    f.position.set(-0.05, -0.08, s * 0.5)
    f.rotation.set(s * 0.5, 0, -0.3)
    group.add(f)
  }
  const bendFin = finMat.clone()
  const finSwim = addSwim(bendFin, { time, axis: 'z', from: -0.2, span: 1.0, freq: 2.4, wave: 2.5, amp: 0.1 })
  const tailFin = new THREE.Mesh(finShape([[-1.02, 0.04], [-1.5, 0.42], [-1.6, 0.1], [-1.6, -0.12], [-1.5, -0.38], [-1.02, -0.04]]), bendFin)
  group.add(tailFin)
  const dorsal = new THREE.Mesh(finShape([[-0.3, 0.42], [-0.75, 0.3], [-0.62, 0.62]]), bendFin)
  group.add(dorsal)

  // 발광 미끼(일리시움 + 에스카)
  const rod = new THREE.CatmullRomCurve3([
    new THREE.Vector3(front - 0.45, 0.6, 0),
    new THREE.Vector3(front - 0.2, 1.15, 0),
    new THREE.Vector3(front + 0.35, 1.35, 0),
    new THREE.Vector3(front + 0.62, 1.05, 0),
  ])
  group.add(new THREE.Mesh(new THREE.TubeGeometry(rod, 40, 0.016, 6), new THREE.MeshStandardMaterial({ color: '#4a3c33', roughness: 0.6 })))
  const lure = new THREE.Group()
  lure.position.copy(rod.getPoint(1))
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), new THREE.MeshBasicMaterial({ color: '#f2feff', toneMapped: false }))
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#7ff3ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
  halo.scale.setScalar(1.5)
  const halo2 = new THREE.Sprite(halo.material.clone())
  halo2.material.opacity = 0.35
  halo2.scale.setScalar(4)
  const light = new THREE.PointLight('#8ff4ff', 6, 6, 1.4)
  lure.add(bulb, halo, halo2, light)
  group.add(lure)

  return { group, lure, light, halo, jaw, swim: [swim, finSwim] }
}

// ── 향유고래 ── 길이 5, 머리 +x. { group, swim }
export function makeWhale(time) {
  const group = new THREE.Group()
  const L = 5
  const body = bodyGeometry(
    (t) => {
      const nose = Math.sqrt(THREE.MathUtils.smoothstep(t, 0, 0.05))
      let h
      let w
      if (t < 0.36) {
        h = THREE.MathUtils.lerp(0.22, 0.6, nose)
        w = THREE.MathUtils.lerp(0.2, 0.5, nose) * (1 - 0.06 * (1 - t / 0.36))
      } else if (t < 0.72) {
        const k = (t - 0.36) / 0.36
        h = THREE.MathUtils.lerp(0.6, 0.42, k) + 0.05 * Math.exp(-Math.pow((t - 0.62) / 0.04, 2))
        w = THREE.MathUtils.lerp(0.52, 0.34, k)
      } else {
        const k = Math.pow((t - 0.72) / 0.28, 0.9)
        h = THREE.MathUtils.lerp(0.42, 0.075, k)
        w = THREE.MathUtils.lerp(0.34, 0.06, k)
      }
      const n = THREE.MathUtils.lerp(3.4, 2, THREE.MathUtils.smoothstep(t, 0.25, 0.42))
      return { h, w, n, y: t < 0.4 ? 0.05 * (1 - t / 0.4) : 0 }
    },
    { length: L, seg: 90, rad: 36 },
  )
  // 머리 뒤 주름
  const p = body.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const t = 0.5 - x / L
    if (t < 0.36) continue
    const r = Math.hypot(y, z) || 1
    const belly = THREE.MathUtils.smoothstep(-y / r, -0.2, 0.6)
    const d = (Math.sin(x * 26 + fbm(x, y * 3, z * 3) * 5) * 0.004 * (0.35 + belly) + fbm(x * 2, y * 2, z * 2) * 0.018) * Math.min(1, (t - 0.36) * 8)
    p.setY(i, y + (y / r) * d)
    p.setZ(i, z + (z / r) * d)
  }
  body.computeVertexNormals()
  const slate = new THREE.Color('#3b434b')
  const light = new THREE.Color('#6c757d')
  const scar = new THREE.Color('#a9b2b8')
  paint(body, (x, y, z, c) => {
    const n = fbm(x * 1.6, y * 1.6, z * 1.6) * 0.5 + 0.5
    c.copy(slate).lerp(light, n * 0.5)
    const s = fbm(x * 14 + 7, y * 14, z * 14)
    if (s > 0.42 && x > 1.1) c.lerp(scar, 0.18)
  })
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 })
  const swim = addSwim(skin, { time, axis: 'y', from: 0.2, span: 2.6, freq: 1.5, wave: 2.2, amp: 0.2 })
  group.add(new THREE.Mesh(body, skin))

  // 아래턱
  const jaw = bodyGeometry((t) => ({ h: 0.035 + 0.02 * Math.sin(Math.PI * t), w: 0.07 * (0.5 + 0.5 * t) + 0.02 }), { length: 1.5, seg: 20, rad: 12 })
  paint(jaw, (x, y, z, c) => c.set('#5d666d'))
  const jawSkin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 })
  const jawSwim = addSwim(jawSkin, { time, axis: 'y', from: 0.2 - (L / 2 - 0.95), span: 2.6, freq: 1.5, wave: 2.2, amp: 0.2 })
  const jawMesh = new THREE.Mesh(jaw, jawSkin)
  jawMesh.position.set(L / 2 - 0.98, -0.46, 0)
  group.add(jawMesh)
  // 눈
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: '#06080a', roughness: 0.1 }))
    eye.position.set(L / 2 - 1.75, -0.25, s * 0.46)
    group.add(eye)
  }
  // 꼬리지느러미(수평) + 가슴지느러미
  const finMat = new THREE.MeshStandardMaterial({ color: '#40484f', roughness: 0.55, side: THREE.DoubleSide })
  const fluke = finShape([
    [-2.38, 0],
    [-2.6, 0.5],
    [-2.82, 0.92],
    [-2.98, 0.86],
    [-2.88, 0.42],
    [-2.97, 0.06],
    [-2.92, 0],
    [-2.97, -0.06],
    [-2.88, -0.42],
    [-2.98, -0.86],
    [-2.82, -0.92],
    [-2.6, -0.5],
  ])
  fluke.rotateX(Math.PI / 2)
  const flukeMat = finMat.clone()
  const flukeSwim = addSwim(flukeMat, { time, axis: 'y', from: 0.2, span: 2.6, freq: 1.5, wave: 2.2, amp: 0.2 })
  group.add(new THREE.Mesh(fluke, flukeMat))
  const pect = finShape([[0, 0], [-0.35, 0.1], [-0.55, 0.04], [-0.3, -0.08]])
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(pect, finMat)
    f.position.set(L / 2 - 2.0, -0.38, s * 0.4)
    f.rotation.set(Math.PI / 2 + s * 0.5, 0, 0.3)
    group.add(f)
  }
  return { group, swim: [swim, flukeSwim, jawSwim] }
}

// ── 바위 ── 노이즈로 깎은 이코사면체
export function rockGeometry(seed, scale = [1, 1, 1], rough = 0.45) {
  const g = new THREE.IcosahedronGeometry(1, 5)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = fbm(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4 - seed, 5)
    const ridge = 1 - Math.abs(fbm(v.x * 3 + seed * 2, v.y * 3, v.z * 3, 3))
    v.multiplyScalar(1 + n * rough + ridge * 0.08)
    p.setXYZ(i, v.x * scale[0], v.y * scale[1], v.z * scale[2])
  }
  g.computeVertexNormals()
  return g
}

// ── 해저 통신 중계기 ── 길이 방향 = y (나중에 케이블 방향으로 회전)
export function repeaterGeometry() {
  const prof = [
    [0, -1.5], [0.06, -1.48], [0.09, -1.35], [0.14, -1.15], [0.2, -0.95], [0.27, -0.8], [0.3, -0.7],
    [0.3, 0.7], [0.27, 0.8], [0.2, 0.95], [0.14, 1.15], [0.09, 1.35], [0.06, 1.48], [0, 1.5],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  return new THREE.LatheGeometry(prof, 40)
}
