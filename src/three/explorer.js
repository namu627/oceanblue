import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { fbm, merge, paint } from './creatures.js'

// ── 해저 탐사선 ── 현대식 유선형 심해 탐사정. 흰 외피, 앞 돔 유리, 흑연색 하부, 시안 LED.
// 앞 = +z (Object3D.lookAt으로 진행 방향을 바라보게)
export function makeROV(glow) {
  const group = new THREE.Group()
  const shell = new THREE.MeshStandardMaterial({ color: '#eef1f3', roughness: 0.3, metalness: 0.08 })
  const graphite = new THREE.MeshStandardMaterial({ color: '#2a3137', roughness: 0.45, metalness: 0.55 })
  const dark = new THREE.MeshStandardMaterial({ color: '#12161a', roughness: 0.6, metalness: 0.4 })
  const glass = new THREE.MeshStandardMaterial({ color: '#0a1c26', roughness: 0.03, metalness: 0.95, emissive: '#0b3444', emissiveIntensity: 0.55, transparent: true, opacity: 0.92 })
  const led = new THREE.MeshBasicMaterial({ color: '#5ce1ff' })
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = group) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, rz)
    parent.add(m)
    return m
  }
  // 몸통: 꼬리에서 가늘게 시작해 가운데가 가장 굵고, 앞은 돔 유리를 받치는 둥근 어깨 (회전체, 길이 방향 z)
  const R = (u) => {
    // u: 0 = 꼬리(z -1.35), 1 = 앞 어깨(z 0.9)
    if (u < 0.55) return 0.17 + 0.33 * Math.sin((u / 0.55) * Math.PI * 0.5)
    return 0.5 - 0.08 * Math.pow((u - 0.55) / 0.45, 2)
  }
  const prof = []
  for (let k = 0; k <= 32; k++) prof.push(new THREE.Vector2(R(k / 32), -1.35 + (k / 32) * 2.25))
  prof.push(new THREE.Vector2(0.001, 0.9))
  const body = new THREE.LatheGeometry(prof, 48)
  body.rotateX(Math.PI / 2)
  body.scale(1, 0.84, 1)
  add(body, shell, 0, 0, 0)
  // 앞: 돔 유리 + 흑연색 테두리
  const dome = new THREE.SphereGeometry(0.42, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)
  dome.rotateX(Math.PI / 2)
  dome.scale(1, 0.84, 1)
  add(dome, glass, 0, 0, 0.9)
  const rim = new THREE.TorusGeometry(0.42, 0.035, 10, 48)
  rim.scale(1, 0.84, 1)
  add(rim, graphite, 0, 0, 0.9)
  // 아래: 흑연색 배 부분 + 스키드 + 접힌 작업 팔
  add(new RoundedBoxGeometry(0.62, 0.2, 1.7, 3, 0.08), graphite, 0, -0.36, -0.05)
  for (const x of [-0.3, 0.3]) {
    add(new RoundedBoxGeometry(0.05, 0.05, 1.7, 2, 0.02), graphite, x, -0.56, 0)
    for (const z of [-0.5, 0.5]) add(new THREE.BoxGeometry(0.035, 0.16, 0.035), graphite, x, -0.47, z)
  }
  for (const x of [-0.18, 0.18]) {
    add(new RoundedBoxGeometry(0.06, 0.06, 0.36, 2, 0.02), graphite, x, -0.38, 0.86, 0.35)
    add(new RoundedBoxGeometry(0.05, 0.05, 0.26, 2, 0.02), graphite, x, -0.5, 1.08, -0.5)
    add(new THREE.BoxGeometry(0.08, 0.025, 0.07), dark, x, -0.59, 1.17)
  }
  // 옆: 시안 LED 줄 + 짧은 받침대 끝의 추진기 포드
  for (const sgn of [-1, 1]) {
    add(new THREE.BoxGeometry(0.012, 0.022, 1.3), led, sgn * 0.505, 0.04, -0.05)
    add(new RoundedBoxGeometry(0.26, 0.05, 0.22, 2, 0.02), graphite, sgn * 0.56, -0.12, -0.35)
    add(new THREE.CapsuleGeometry(0.1, 0.28, 6, 16), graphite, sgn * 0.74, -0.12, -0.35, Math.PI / 2)
    add(new THREE.TorusGeometry(0.1, 0.018, 6, 20), led, sgn * 0.74, -0.12, -0.6)
  }
  // 위: 낮은 등지느러미 + 센서 돔 + 안테나/상태등
  const finShape = new THREE.Shape()
  finShape.moveTo(-0.5, 0)
  finShape.lineTo(0.35, 0)
  finShape.quadraticCurveTo(0.1, 0.22, -0.35, 0.24)
  finShape.closePath()
  const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 })
  fin.translate(0, 0, -0.06)
  fin.rotateY(-Math.PI / 2)
  add(fin, shell, 0, 0.38, -0.25)
  add(new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), graphite, 0, 0.4, 0.3)
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.26, 6), graphite, 0, 0.72, -0.5)
  const status = add(new THREE.SphereGeometry(0.024, 8, 6), new THREE.MeshBasicMaterial({ color: '#7dffb0' }), 0, 0.86, -0.5)
  // 꼬리: 십자 안정판 + 덮개 프로펠러(시안 링)
  for (let k = 0; k < 4; k++) {
    const g = new THREE.BoxGeometry(0.025, 0.3, 0.34)
    g.translate(0, 0.27, 0)
    add(g, graphite, 0, 0, -1.08, 0, 0, (k * Math.PI) / 2 + Math.PI / 4)
  }
  add(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 32, 1, true), graphite, 0, 0, -1.36, Math.PI / 2)
  add(new THREE.TorusGeometry(0.25, 0.022, 8, 32), led, 0, 0, -1.46)
  const prop = new THREE.Group()
  prop.position.set(0, 0, -1.4)
  group.add(prop)
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), dark, 0, 0, 0, Math.PI / 2, 0, 0, prop)
  for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.05, 0.2, 0.012), dark, 0, 0, 0, 0.45, 0, (k * Math.PI * 2) / 5, prop).translateY(0.1)
  // 조명: 돔 위 가는 LED 막대 두 개
  add(new RoundedBoxGeometry(0.8, 0.06, 0.08, 2, 0.03), graphite, 0, 0.36, 0.78)
  const lampGeo = new RoundedBoxGeometry(0.22, 0.045, 0.03, 2, 0.015)
  const lampMat = new THREE.MeshBasicMaterial({ color: '#2a3a44' })
  const lamps = [-0.24, 0.24].map((x) => add(lampGeo, lampMat, x, 0.36, 0.825))

  // 조명: 앞쪽 아래를 비추는 스포트라이트 + 빛줄기 원뿔
  const target = new THREE.Object3D()
  target.position.set(0, -3.2, 7)
  group.add(target)
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { uOn: { value: 0 }, uCol: { value: new THREE.Color('#cdefff') } },
    vertexShader: `
      varying float vV; varying float vRim;
      void main() {
        vV = uv.y;
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vRim = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOn; uniform vec3 uCol; varying float vV; varying float vRim;
      void main() {
        float a = pow(vV, 1.3) * vRim * uOn * 0.3;
        gl_FragColor = vec4(uCol * a, a);
        #include <colorspace_fragment>
      }`,
  })
  const coneGeo = new THREE.ConeGeometry(2.4, 9, 24, 1, true)
  coneGeo.translate(0, -4.5, 0) // 꼭짓점이 원점(조명)에 오게
  const spots = []
  lamps.forEach((lamp) => {
    const s = new THREE.SpotLight('#dff6ff', 0, 30, 0.42, 0.65, 1.1)
    s.position.copy(lamp.position)
    s.target = target
    group.add(s)
    spots.push(s)
    const cone = new THREE.Mesh(coneGeo, coneMat)
    cone.position.copy(lamp.position)
    cone.lookAt(new THREE.Vector3().copy(target.position))
    cone.rotateX(-Math.PI / 2) // 원뿔 -y축을 조명 방향으로
    group.add(cone)
  })
  const halos = lamps.map((lamp) => {
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#e4f8ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))
    h.position.copy(lamp.position).add(new THREE.Vector3(0, 0, 0.1))
    h.scale.setScalar(0.9)
    group.add(h)
    return h
  })

  // on: 0..1 조명 세기
  const setLights = (on) => {
    spots.forEach((s) => (s.intensity = on * 40))
    coneMat.uniforms.uOn.value = on
    halos.forEach((h) => (h.material.opacity = on))
    lampMat.color.set('#2a3a44').lerp(new THREE.Color('#f2fbff'), on)
  }
  return { group, setLights, status, prop }
}

// ── 난파선 ── 이름 없는 옛 목조 범선. 길이 방향 = x (뱃머리 +x), 용골 y = 0
// 배는 두 동강 나 있다: [x0, x1] 구간만 만든다. 부러진 쪽 끝은 판자가 들쭉날쭉하다.
// lo = true면 트윈(와이어프레임)용 저해상도
export const BREAK_X = -1.0
// 선미·선수가 높이 솟은 갑판선 (선미가 가장 높다: 선장실에서 앞을 내려다본다)
const sheer = (X) => 1.9 + 1.3 * (1 - THREE.MathUtils.smoothstep(X, -7, -3.2)) + 0.55 * THREE.MathUtils.smoothstep(X, 3.5, 7)
const beam = (X) => {
  const bow = Math.pow(THREE.MathUtils.clamp((7.2 - X) / 4.6, 0, 1), 0.55)
  const stern = 1 - 0.18 * (1 - THREE.MathUtils.smoothstep(X, -7, -5)) // 선미는 각진 판(트랜섬)
  return 1.55 * bow * stern + 0.02
}
const hash = (n) => {
  const v = Math.sin(n * 12.9898 + 4.1) * 43758.5453
  return v - Math.floor(v)
}
const PLANK = 4.2 // 1단위 높이당 판자 수
// 부러진 끝에서 판자 하나가 얼마나 더 안쪽에서 끊겼는지 (판자마다 제각각)
const plankCut = (row, side) => (hash(row * 7.3 + side * 91.7) < 0.25 ? 0.05 : 0.15 + 1.5 * Math.pow(hash(row * 3.1 + side * 17.9), 1.4))
// 선체 단면 위의 점 (a: 0 = 왼쪽 갑판 끝, π/2 = 용골, π = 오른쪽 갑판 끝)
const section = (X, a, out) => {
  const w = beam(X)
  const d = sheer(X)
  const keel = 0.5 * THREE.MathUtils.smoothstep(X, 4, 7.2)
  const c = Math.cos(a)
  const sn = Math.sin(a)
  // 둥근 배 밑 + 갑판 쪽으로 살짝 오므라드는 옆면
  out[0] = d - (d - keel) * Math.pow(sn, 0.75)
  out[1] = -Math.sign(c) * Math.pow(Math.abs(c), 0.55) * w * (1 - 0.1 * Math.pow(1 - sn, 3))
  return out
}
function hullGeometry(lo, x0, x1) {
  const N = Math.round((lo ? 22 : 120) * (x1 - x0) / 14) + 2
  const M = lo ? 10 : 80
  const K = lo ? 1 : 14 // 갑판 가로 칸 수
  const pos = []
  const idx = []
  const deck = []
  const brokeLo = x0 > -6.9 // 아래쪽 끝이 부러진 면인가
  const end = brokeLo ? x0 : x1
  const inward = brokeLo ? 1 : -1
  const yz = [0, 0]
  // 판자 끝 자르기: 부러진 끝에서 판자 길이만큼은 그 판자의 끝 위치로 모은다
  const clampX = (X, row, side) => {
    if (lo) return X
    const lim = end + inward * plankCut(row, side)
    return brokeLo ? Math.max(X, lim) : Math.min(X, lim)
  }
  for (let i = 0; i <= N; i++) {
    const X = x0 + (i / N) * (x1 - x0)
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * Math.PI
      section(X, a, yz)
      const row = Math.floor(yz[0] * PLANK)
      const side = a < Math.PI / 2 ? 0 : 1
      const cx = clampX(X, row, side)
      if (cx !== X) section(cx, a, yz)
      pos.push(cx, yz[0], yz[1])
    }
    deck.push([X, sheer(X) - 0.12, beam(X) * 0.9])
  }
  const row = M + 1
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * row + j
      const b = a + row
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const hull = new THREE.BufferGeometry()
  hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  hull.setIndex(idx)
  hull.computeVertexNormals()
  // 갑판: 세로 판자(K칸)마다 부러진 길이가 다르다
  const dp = []
  const di = []
  deck.forEach(([X, y, w], i) => {
    for (let k = 0; k <= K; k++) {
      const z = -w + (2 * w * k) / K
      const cx = clampX(X, 500 + Math.min(k, K - 1), 2)
      dp.push(cx, cx === X ? y : sheer(cx) - 0.12, z * (cx === X ? 1 : beam(cx) / beam(X)))
    }
    if (i) {
      for (let k = 0; k < K; k++) {
        const a = (i - 1) * (K + 1) + k
        const b = i * (K + 1) + k
        di.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  })
  const deckG = new THREE.BufferGeometry()
  deckG.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3))
  deckG.setIndex(di)
  deckG.computeVertexNormals()
  // 부러진 판자 끝의 나무 조각(쪼개진 가시)
  const shards = []
  if (!lo) {
    for (let side = 0; side < 2; side++) {
      for (let r = 0; r < 14; r++) {
        if (hash(r * 5.7 + side * 3.3) < 0.35) continue
        const a = side === 0 ? (r / 14) * (Math.PI / 2) : Math.PI - (r / 14) * (Math.PI / 2)
        const X = end + inward * 0.6
        section(X, a, yz)
        const prow = Math.floor(yz[0] * PLANK)
        const ex = end + inward * plankCut(prow, side)
        section(ex, a, yz)
        const len = 0.25 + 0.6 * hash(r * 9.1 + side)
        const g = new THREE.BoxGeometry(len, 0.03 + 0.05 * hash(r + side * 2.2), 0.08 + 0.08 * hash(r * 1.7))
        g.translate((-inward * len) / 2, 0, 0)
        g.rotateZ((hash(r * 2.9 + side) - 0.5) * 0.9)
        g.rotateY((hash(r * 4.3 + side) - 0.5) * 0.7)
        g.translate(ex, yz[0], yz[1] * 0.97)
        shards.push(g)
      }
    }
  }
  return { hull, deck: deckG, shards, deckY: (X) => deck[THREE.MathUtils.clamp(Math.round(((X - x0) / (x1 - x0)) * N), 0, N)][1] }
}

function wreckParts(lo, x0, x1) {
  const { hull, deck, shards, deckY } = hullGeometry(lo, x0, x1)
  const parts = [hull, deck, ...shards]
  const inside = (x) => x > x0 && x < x1
  const seg = lo ? 6 : 12
  const put = (g, x) => inside(x) && parts.push(g)
  const dark = (g) => ((g.userData.color = '#140e09'), g) // 창·구멍처럼 어둡게 칠할 조각
  // 선미: 선장실(갑판선을 따라 앉은 경사 지붕 덩어리) + 창, 선미 판(트랜섬) + 선미 창, 키, 선미등
  if (inside(-5.5)) {
    const xa = -6.7
    const xb = -4.3
    const roofY = Math.max(deckY(xa), deckY(xb)) + 0.8
    const HW = 0.95 // 선장실 반폭
    // 판자로 짠 몸체: 바닥은 갑판선을 따르고, 지붕은 수평 + 가운데가 볼록(캠버), 위로 갈수록 살짝 오므라들고,
    // 세월에 처지고 비틀린 듯 조금씩 일그러진다. 정점을 촘촘히 둬야 판자 무늬가 칠해진다.
    const cab = new THREE.BoxGeometry(1, 1, 1, lo ? 3 : 30, lo ? 2 : 14, lo ? 2 : 16)
    const cp = cab.attributes.position
    for (let i = 0; i < cp.count; i++) {
      const u = cp.getX(i) + 0.5
      const v = cp.getY(i) + 0.5
      const w = cp.getZ(i) * 2
      const x = xa + u * (xb - xa)
      const floor = deckY(x) - 0.08
      const top = roofY + 0.1 * (1 - w * w) - 0.07 * Math.sin(u * Math.PI) // 캠버 + 가운데 처짐
      let y = floor + v * (top - floor)
      let z = w * HW * (1 - 0.07 * v)
      let xx = x
      if (!lo) {
        xx += fbm(x * 1.3, y * 1.3, z * 1.3, 2) * 0.05
        y += fbm(x * 1.1 + 4, y * 1.1, z * 1.1, 2) * 0.04
        z += fbm(x * 1.2, y * 1.2 + 8, z * 1.2, 2) * 0.04
      }
      cp.setXYZ(i, xx, y, z)
    }
    cab.computeVertexNormals()
    parts.push(cab)
    if (!lo) {
      const beamWood = (g) => ((g.userData.color = '#2b1e13'), g) // 짙은 각재
      // 지붕 처마: 몸체보다 조금 넓은 판 (가장자리가 내려앉은 캠버)
      const roof = new THREE.BoxGeometry(1, 1, 1, 24, 1, 12)
      const rp = roof.attributes.position
      for (let i = 0; i < rp.count; i++) {
        const u = rp.getX(i) + 0.5
        const w = rp.getZ(i) * 2
        const y = roofY + 0.1 * (1 - w * w) - 0.07 * Math.sin(u * Math.PI) + 0.02 + (rp.getY(i) + 0.5) * 0.08
        rp.setXYZ(i, xa - 0.2 + u * (xb - xa + 0.35), y, w * (HW + 0.14))
      }
      roof.computeVertexNormals()
      parts.push(roof)
      // 모서리 기둥 + 처마 아래 가로대
      for (const x of [xa + 0.05, xb - 0.05]) {
        for (const z of [-HW + 0.04, HW - 0.04]) {
          const h = roofY - deckY(x) + 0.1
          const g = new THREE.BoxGeometry(0.11, h, 0.11)
          g.translate(x, deckY(x) - 0.08 + h / 2, z)
          parts.push(beamWood(g))
        }
      }
      // 창: 짙은 유리 + 밝은 나무 창틀. 옆면 3개씩, 앞벽 3개 (뱃머리 쪽을 내다본다)
      const frame = (g) => ((g.userData.color = '#5c4632'), g)
      for (const z of [-1, 1]) {
        for (const x of [-6.2, -5.6, -5.0]) {
          const f = new THREE.BoxGeometry(0.34, 0.28, 0.04)
          f.translate(x, roofY - 0.36, z * (HW * 0.94 + 0.01))
          parts.push(frame(f))
          const g = new THREE.BoxGeometry(0.24, 0.18, 0.05)
          g.translate(x, roofY - 0.36, z * (HW * 0.94 + 0.02))
          parts.push(dark(g))
        }
      }
      for (const z of [-0.55, 0, 0.55]) {
        const f = new THREE.BoxGeometry(0.04, 0.3, 0.38)
        f.translate(xb + 0.02, roofY - 0.33, z)
        parts.push(frame(f))
        const g = new THREE.BoxGeometry(0.05, 0.2, 0.28)
        g.translate(xb + 0.03, roofY - 0.33, z)
        parts.push(dark(g))
      }
      const door = new THREE.BoxGeometry(0.04, 0.46, 0.34)
      door.translate(xb + 0.03, deckY(xb) + 0.25, 0)
      parts.push(dark(door))
    }
  }
  if (x0 < -6.9) {
    // 선미 판: 선체 끝 단면을 막는 판 + 선미 창 한 줄
    const yz = [0, 0]
    const sh = new THREE.Shape()
    for (let k = 0; k <= 24; k++) {
      section(-7, (k / 24) * Math.PI, yz)
      if (k) sh.lineTo(-yz[1], yz[0])
      else sh.moveTo(-yz[1], yz[0])
    }
    sh.closePath()
    const tr = new THREE.ShapeGeometry(sh, 6)
    tr.rotateY(Math.PI / 2)
    tr.translate(-7, 0, 0)
    parts.push(tr)
    if (!lo) {
      for (const z of [-0.75, -0.25, 0.25, 0.75]) {
        const g = new THREE.BoxGeometry(0.04, 0.26, 0.3)
        g.translate(-7.01, sheer(-7) - 0.5, z)
        parts.push(dark(g))
      }
      const rail = new THREE.BoxGeometry(0.08, 0.06, beam(-7) * 2)
      rail.translate(-7.02, sheer(-7) - 0.28, 0)
      parts.push(rail)
      // 키: 선미 아래 뒤로 뻗은 판 (살짝 꺾여 있다)
      const rudder = new THREE.BoxGeometry(0.7, 1.5, 0.08)
      rudder.translate(-0.3, 0, 0)
      rudder.rotateY(0.35)
      rudder.translate(-7.0, 0.85, 0)
      parts.push(rudder)
      // 선미등: 기둥 + 등 상자
      const post = new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6)
      post.translate(-6.85, sheer(-6.85) + 0.27, 0)
      parts.push(post)
      const lamp = new THREE.BoxGeometry(0.16, 0.2, 0.16)
      lamp.translate(-6.85, sheer(-6.85) + 0.62, 0)
      parts.push(dark(lamp))
    }
  }
  // 갑판 가장자리 난간: 기둥 + 위 손잡이 (부러진 끝 근처는 없다)
  if (!lo) {
    const brk = x0 > -6.9 ? x0 : x1
    for (const side of [-1, 1]) {
      let prev = null
      for (let x = -6.85; x <= 6.6; x += 0.45) {
        if (!inside(x) || Math.abs(x - brk) < 0.9) {
          prev = null
          continue
        }
        const z = side * beam(x) * 0.86
        const y = sheer(x) - 0.12
        const p = new THREE.BoxGeometry(0.05, 0.36, 0.05)
        p.translate(x, y + 0.18, z)
        parts.push(p)
        if (prev) {
          const dx = x - prev[0]
          const dy = y - prev[1]
          const dz = z - prev[2]
          const len = Math.hypot(dx, dy, dz)
          const r = new THREE.BoxGeometry(len, 0.045, 0.06)
          r.rotateZ(Math.atan2(dy, dx))
          r.rotateY(-Math.atan2(dz, dx))
          r.translate((x + prev[0]) / 2, (y + prev[1]) / 2 + 0.36, (z + prev[2]) / 2)
          parts.push(r)
        }
        prev = [x, y, z]
      }
    }
  }
  // 돛대: 모두 부러진 밑동
  for (const [x, h, tilt] of [[-2.7, 1.1, 0.12], [0.6, 2.4, -0.1], [3.9, 1.3, 0.14]]) {
    const g = new THREE.CylinderGeometry(0.13, 0.16, h, seg, lo ? 1 : 3)
    if (!lo) {
      // 부러진 꼭대기: 윗면 정점을 제각각 낮춰 쪼개진 단면처럼
      const gp = g.attributes.position
      for (let i = 0; i < gp.count; i++) {
        if (gp.getY(i) > h / 2 - 0.01) gp.setY(i, gp.getY(i) - hash(i * 3.7 + x) * 0.45)
      }
      g.computeVertexNormals()
    }
    g.translate(0, h / 2, 0)
    g.rotateZ(tilt)
    g.translate(x, deckY(x), 0)
    put(g, x)
  }
  // 쓰러진 돛대와 활대가 갑판을 가로지른다
  const fallen = new THREE.CylinderGeometry(0.1, 0.12, 5.6, seg)
  fallen.rotateZ(Math.PI / 2 - 0.12)
  fallen.rotateY(0.38)
  fallen.translate(2.2, deckY(2.2) + 0.45, 0.7)
  put(fallen, 2.2)
  const yard = new THREE.CylinderGeometry(0.06, 0.06, 3.6, seg)
  yard.rotateX(Math.PI / 2 - 0.3)
  yard.translate(1.0, deckY(1.0) + 0.35, -0.3)
  put(yard, 1.0)
  // 뱃머리 기움 돛대(바우스프릿)
  const sprit = new THREE.CylinderGeometry(0.06, 0.1, 2.6, seg)
  sprit.rotateZ(-Math.PI / 2 + 0.35)
  sprit.translate(7.9, sheer(7) + 0.35, 0)
  put(sprit, 6.9)
  return parts
}

const fract = (v) => v - Math.floor(v)

export function makeWreck(x0 = -7, x1 = 7) {
  const parts = wreckParts(false, x0, x1)
  const wood = new THREE.Color('#5b4431')
  const wood2 = new THREE.Color('#3b2c20')
  const crust = new THREE.Color('#4e5a52')
  const geo = merge(
    parts.map((g) => [
      g.userData.color ? paint(g, (x, y, z, c) => c.set(g.userData.color)) : paint(g, (x, y, z, c) => {
        const row = Math.floor(y * 4.2)
        c.copy(wood).lerp(wood2, THREE.MathUtils.smoothstep(fbm(x * 0.5, y * 2.5, z * 0.5, 3), -0.1, 0.35) * 0.7 + hash(row * 3.7) * 0.3) // 판자마다 색이 조금씩 다르다
        c.multiplyScalar(0.86 + 0.14 * Math.sin(x * 22 + fbm(x * 0.6, y * 8, z * 0.6, 2) * 9)) // 나뭇결
        if (Math.abs(z) > 0.3 && Math.abs(fract(y * 4.2) - 0.5) > 0.44) c.multiplyScalar(0.5) // 판자 이음매
        if (Math.abs(z) <= 0.3 || y > sheer(x) - 0.2) if (Math.abs(fract(z * 3.2) - 0.5) > 0.45) c.multiplyScalar(0.6) // 갑판 판자 이음매
        const d = sheer(x)
        if (Math.abs(z) > 0.8 && Math.abs(y - (d - 0.55)) < 0.13 && Math.abs(fract(x / 1.3) - 0.5) < 0.1) c.multiplyScalar(0.15) // 포문
        c.lerp(crust, THREE.MathUtils.smoothstep(fbm(x * 0.35 + 7, y * 1.6, z * 0.35, 3) + (1.4 - y) * 0.15, 0.05, 0.45) * 0.75) // 아래쪽 퇴적·부착물
        c.multiplyScalar(0.8 + 0.3 * fbm(x * 3, y * 3, z * 3, 2))
      }),
      wood,
    ]),
  )
  geo.computeVertexNormals()

  // 스캔 띠: 레이저가 지나가는 x 위치가 빛난다
  const scanU = { uScan: { value: -99 }, uScanOn: { value: 0 }, uScanCol: { value: new THREE.Color('#5ce1ff') } }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.3, side: THREE.DoubleSide })
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, scanU)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc; uniform float uScan; uniform float uScanOn; uniform vec3 uScanCol;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float band = smoothstep(0.18, 0.0, abs(vLoc.x - uScan));
        float grid = 1.0 - min(abs(fract(vLoc.y * 2.5) - 0.5) / fwidth(vLoc.y * 2.5) , 1.0);
        totalEmissiveRadiance += uScanCol * uScanOn * (band * 1.4 + smoothstep(0.9, 0.0, abs(vLoc.x - uScan)) * grid * 0.6);`,
      )
  }
  mat.customProgramCacheKey = () => 'wreck-scan'
  const mesh = new THREE.Mesh(geo, mat)

  // 디지털 트윈: 저해상도 와이어프레임. uReveal보다 앞(선수 쪽)만 보인다.
  const twinMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uReveal: { value: -99 }, uOpacity: { value: 0 }, uCol: { value: new THREE.Color('#7fe9ff') } },
    vertexShader: `varying float vX; void main() { vX = position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uReveal; uniform float uOpacity; uniform vec3 uCol; varying float vX;
      void main() {
        float a = step(uReveal, vX) * uOpacity * (0.55 + 0.45 * smoothstep(0.8, 0.0, vX - uReveal));
        gl_FragColor = vec4(uCol * a, a);
        #include <colorspace_fragment>
      }`,
  })
  const twin = new THREE.Group()
  const lo = wreckParts(true, x0, x1)
  twin.add(new THREE.LineSegments(new THREE.WireframeGeometry(lo[0]), twinMat))
  lo.slice(1).forEach((g) => twin.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), twinMat)))

  const group = new THREE.Group()
  group.add(mesh, twin)
  // 앞부분만 있는 배라면, 없는 뒷부분의 형태를 빨간 와이어프레임으로 (스캔이 지나간 만큼 보인다)
  let ghost = null
  let ghostMat = null
  if (x0 > -6.9) {
    ghostMat = twinMat.clone()
    ghostMat.uniforms.uCol.value = new THREE.Color('#ff5a5a')
    ghostMat.depthTest = false // 지형에 묻혀도 보이게 (투시 표시)
    ghost = new THREE.Group()
    const gp = wreckParts(true, -7, x0)
    ghost.add(new THREE.LineSegments(new THREE.WireframeGeometry(gp[0]), ghostMat))
    gp.slice(1).forEach((g) => ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), ghostMat)))
    group.add(ghost)
  }
  return { group, mesh, twin, scanU, twinMat, ghost, ghostMat, x0, x1 }
}

// 오차 표시 라벨 (캔버스 스프라이트)
export function makeLabel(subCol = 'rgba(92,225,255,0.85)', mainCol = '#e9fbff') {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false }))
  sprite.scale.set(3.2, 0.8, 1)
  sprite.renderOrder = 10
  let last = ''
  const set = (text, sub) => {
    const key = text + sub
    if (key === last) return
    last = key
    g.clearRect(0, 0, 512, 128)
    g.fillStyle = subCol
    g.font = '500 30px "JetBrains Mono", ui-monospace, monospace'
    g.fillText(sub, 8, 40)
    g.fillStyle = mainCol
    g.font = '600 56px "JetBrains Mono", ui-monospace, monospace'
    g.fillText(text, 8, 106)
    tex.needsUpdate = true
  }
  return { sprite, set, tex }
}

// ── 보물상자 ── 인양할 '배운 것'. 바닥 가운데 = 원점, 손잡이(밧줄 거는 곳) = (±0.5, 0.36, 0)
export function makeChest(glow) {
  const group = new THREE.Group()
  // 나무 판자 텍스처(캔버스): 판자마다 다른 색, 나뭇결 줄무늬, 옹이, 판자 사이 틈, 못, 물때·따개비 얼룩
  const woodTex = (() => {
    const W = 512
    const c = document.createElement('canvas')
    c.width = c.height = W
    const g = c.getContext('2d')
    const ROWS = 5
    const h = W / ROWS
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let r = 0; r < ROWS; r++) {
      const y0 = r * h
      const k0 = 0.8 + rnd() * 0.35 // 판자마다 밝기만 다르게 (색조는 같은 젖은 갈색)
      const base = [86 * k0, 62 * k0, 40 * k0]
      g.fillStyle = `rgb(${base.map(Math.round).join(',')})`
      g.fillRect(0, y0, W, h)
      // 나뭇결: 판자 길이 방향으로 물결치는 가는 줄
      for (let k = 0; k < 26; k++) {
        const yy = y0 + rnd() * h
        const amp = 2 + rnd() * 4
        const fr = 0.01 + rnd() * 0.02
        const ph = rnd() * 6
        g.strokeStyle = `rgba(${rnd() < 0.6 ? '38,26,16' : '120,92,64'},${0.15 + rnd() * 0.22})`
        g.lineWidth = 0.6 + rnd() * 1.6
        g.beginPath()
        for (let x = 0; x <= W; x += 8) g.lineTo(x, yy + Math.sin(x * fr + ph) * amp)
        g.stroke()
      }
      // 옹이
      if (rnd() < 0.8) {
        const kx = 40 + rnd() * (W - 80)
        const ky = y0 + h * (0.3 + rnd() * 0.4)
        for (let q = 5; q > 0; q--) {
          g.strokeStyle = `rgba(45,26,12,${0.25 + 0.1 * q})`
          g.lineWidth = 1.4
          g.beginPath()
          g.ellipse(kx, ky, q * 4.5, q * 2.2, 0, 0, Math.PI * 2)
          g.stroke()
        }
      }
      // 판자 사이 틈 + 못
      g.fillStyle = 'rgba(18,10,5,0.9)'
      g.fillRect(0, y0, W, 3)
      g.fillStyle = 'rgba(30,26,22,0.95)'
      for (const nx of [18, W - 18]) {
        g.beginPath()
        g.arc(nx, y0 + h / 2, 4, 0, Math.PI * 2)
        g.fill()
      }
    }
    // 물때·따개비: 녹회색 얼룩 + 작은 흰 점
    for (let k = 0; k < 60; k++) {
      const x = rnd() * W
      const y = rnd() * W
      const r = 8 + rnd() * 40
      const gr = g.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, `rgba(48,56,50,${0.15 + rnd() * 0.2})`)
      gr.addColorStop(1, 'rgba(48,56,50,0)')
      g.fillStyle = gr
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    for (let k = 0; k < 50; k++) {
      g.fillStyle = `rgba(170,170,155,${0.15 + rnd() * 0.25})`
      g.beginPath()
      g.arc(rnd() * W, rnd() * W, 0.8 + rnd() * 2.2, 0, Math.PI * 2)
      g.fill()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  })()
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.92, metalness: 0, bumpMap: woodTex, bumpScale: 0.6 })
  // 뚜껑(원통)은 uv의 u가 둘레 방향이라 판자가 길이 방향으로 눕도록 90° 돌린 텍스처
  const lidTex = woodTex.clone()
  lidTex.center.set(0.5, 0.5)
  lidTex.rotation = Math.PI / 2
  const lidMat = new THREE.MeshStandardMaterial({ map: lidTex, roughness: 0.92, metalness: 0, bumpMap: lidTex, bumpScale: 0.6 })
  const iron = new THREE.MeshStandardMaterial({ color: '#2c2a27', roughness: 0.55, metalness: 0.8 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.58), woodMat)
  body.position.y = 0.25
  group.add(body)
  // 뚜껑: 뒤쪽 경첩을 축으로 열린다 (반원통)
  const hinge = new THREE.Group()
  hinge.position.set(0, 0.5, -0.29)
  group.add(hinge)
  const lidGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.9, 20, 1, false, 0, Math.PI)
  lidGeo.rotateZ(Math.PI / 2) // 축 = x, 윗반원
  lidGeo.translate(0, 0, 0.29)
  const lid = new THREE.Mesh(lidGeo, lidMat)
  hinge.add(lid)
  // 쇠띠·자물쇠·손잡이
  for (const x of [-0.3, 0.3]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.6), iron)
    band.position.set(x, 0.25, 0)
    group.add(band)
    const lb = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.025, 6, 20, Math.PI), iron)
    lb.rotation.y = Math.PI / 2
    lb.position.set(x, 0, 0.29)
    hinge.add(lb)
  }
  // 걸쇠 + 매달린 자물쇠
  const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.03), iron)
  hasp.position.set(0, 0.46, 0.305)
  group.add(hasp)
  const brass = new THREE.MeshStandardMaterial({ color: '#8a6a2e', roughness: 0.4, metalness: 0.85 })
  const padlock = new THREE.Group()
  padlock.position.set(0, 0.36, 0.34)
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16, Math.PI), iron)
  shackle.position.y = 0.04
  const lockBody = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.11, 0.05, 2, 0.015), brass)
  lockBody.position.y = -0.02
  const keyhole = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.035, 0.01), new THREE.MeshBasicMaterial({ color: '#0a0a0a' }))
  keyhole.position.set(0, -0.025, 0.026)
  padlock.add(shackle, lockBody, keyhole)
  group.add(padlock)
  for (const x of [-0.47, 0.47]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 14), iron)
    h.rotation.y = Math.PI / 2
    h.position.set(x, 0.36, 0)
    group.add(h)
  }
  // 안쪽 금빛
  const gold = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.48), new THREE.MeshStandardMaterial({ color: '#c99a3a', emissive: '#ffb84a', emissiveIntensity: 0, metalness: 0.9, roughness: 0.3 }))
  gold.position.y = 0.46
  group.add(gold)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffc864', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))
  halo.position.y = 0.62
  halo.scale.setScalar(1.6)
  group.add(halo)
  const light = new THREE.PointLight('#ffbf5a', 0, 4, 1.6)
  light.position.y = 0.8
  group.add(light)
  // open: 0..1 뚜껑 열림 + 금빛
  // glow: 0..1 닫힌 뚜껑 틈으로 새는 금빛. 자물쇠가 걸려 있어 뚜껑은 아주 조금만 들린다.
  const setOpen = (glowAmt, pulse = 1) => {
    hinge.rotation.x = -glowAmt * 0.06
    gold.material.emissiveIntensity = glowAmt * 2.2 * pulse
    halo.material.opacity = glowAmt * 0.35 * pulse
    light.intensity = glowAmt * 1.6 * pulse
    padlock.rotation.x = Math.sin(performance.now() * 0.0013) * 0.12 * glowAmt // 매달린 자물쇠가 살짝 흔들린다
  }
  group.scale.setScalar(1.45)
  return { group, setOpen }
}

// ── 인양 풍선(리프트백) ── 수중 인양에 쓰는 낙하산형(아래가 열린) 리프트백.
// 둥근 돔 위 → 아래로 좁아지는 몸통 → 열린 입구. 몸통을 감싼 띠 4줄이 아래 고리 하나로 모인다.
// 원점 = 아래 고리(밧줄 거는 곳), 입구 = y 0.55, 꼭대기 = y 2.6
export function makeLiftBag() {
  const Y0 = 0.55
  const H = 2.05
  // u: 0 = 입구, 1 = 꼭대기
  const R = (u) => (u < 0.7 ? 0.17 + 0.47 * Math.pow(Math.sin((u / 0.7) * Math.PI * 0.5), 1.15) : 0.64 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.7) / 0.3, 2))))
  const prof = []
  for (let k = 0; k <= 40; k++) prof.push(new THREE.Vector2(Math.max(0.001, R(k / 40)), Y0 + (k / 40) * H))
  const bag = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), new THREE.MeshStandardMaterial({ color: '#f0a022', roughness: 0.6, metalness: 0.02, side: THREE.DoubleSide }))
  const strapMat = new THREE.MeshStandardMaterial({ color: '#1f2428', roughness: 0.8 })
  const group = new THREE.Group()
  group.add(bag)
  // 띠: 고리 → 입구 가장자리 → 몸통을 따라 꼭대기까지
  for (let k = 0; k < 4; k++) {
    const ph = (k / 4) * Math.PI * 2 + Math.PI / 4
    const pts = [new THREE.Vector3(0, 0, 0)]
    for (let q = 0; q <= 20; q++) {
      const u = q / 20
      const r = R(u) + 0.012
      pts.push(new THREE.Vector3(Math.cos(ph) * r, Y0 + u * H, Math.sin(ph) * r))
    }
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.018, 5), strapMat))
  }
  // 아래 고리 + 입구 테두리
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 16), new THREE.MeshStandardMaterial({ color: '#8f969c', metalness: 0.9, roughness: 0.35 }))
  ring.rotation.x = Math.PI / 2
  group.add(ring)
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 24), strapMat)
  lip.rotation.x = Math.PI / 2
  lip.position.y = Y0
  group.add(lip)
  return { group }
}
