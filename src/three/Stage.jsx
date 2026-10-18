import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createOcean, depthMeters, terrainH, channelX, LANDMARK_Y, LANDMARK_Z, BUOY_X, SURF } from './ocean.js'
import { hero, overview, chapters, why, profile } from '../content.js'
import { T0, CH, W, E, WHY_IN, WHY_STOP, TOTAL, STOPS, center } from './timeline.js'

gsap.registerPlugin(ScrollTrigger)

const mobile = () => window.matchMedia('(max-width: 820px)').matches
// 챕터별 카메라: 내려다보는 각도, 거리 배율 (소나 챕터는 높이 떠서 지형을 지도처럼 본다)
const LOOK = [0.1, 0.66, 0.3, 0.85, 0.3]
const FAR = [0, 32, 13, 25, 17] // 침몰선은 절벽 끝에서 내려다본다
const FAR_M = [0, 29.5, 13, 36, 22] // 모바일(세로 화면): 침몰선 전체가 들어오게 더 멀리, 더 내려다보며
const LOOK_M = [0.1, 0.66, 0.3, 0.98, 0.3]
const look = (i) => () => (mobile() ? LOOK_M : LOOK)[i] // 0이면 기본 거리, 아니면 카메라까지의 실제 거리
// 챕터 사이 이동 경로: 바닥 가까이 수로(channelX)를 따라 날아간다.
// 키: [z, 바닥 위 높이, 내려다보는 각도, (절대 높이)]. 절대 높이가 있으면 바닥 대신 그 높이를 쓴다(절벽 위 공중).
// 카메라 위치를 (초점, 각도, 거리)로 되돌려 S에 넣는다.
// segs: 진입 → 각 키 사이 → 마지막(다음 챕터 자리로) 구간 비율. 합 = 1
const PATHS = {
  // 정어리 → 소나: 정어리 아래 골짜기로 내려가 골짜기를 타고 사면을 내려간 뒤, 떠오르며 소나 지형을 내려다본다
  1: {
    keys: [
      [4, 2.2, 0.16],
      [-2, 2.0, 0.26],
      [-8, 2.2, 0.42],
      [-14, 2.8, 0.52],
    ],
    segs: [0.24, 0.17, 0.17, 0.14, 0.28],
  },
  // 소나 → 3단계: 내려와서 점선 경로를 그대로 따라가다 고원 끝 절벽을 넘어 아래 단으로
  2: {
    keys: [
      [-36, 3.6, 0.34],
      [-43, 3.2, 0.3],
      [-50, 3.2, 0.3],
      [-57, 3.3, 0.32],
      [-64, 3.8, 0.5],
      [-71, 0, 0.62, -37], // 절벽 끝을 넘어 아래 단을 내려다보며 하강
    ],
    segs: [0.22, 0.11, 0.11, 0.11, 0.12, 0.15, 0.18],
  },
}
const PATH_D = 3 // 경로 비행 중 카메라와 초점 사이 거리
const ease3 = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
// 챕터 사이 이동용: 카드가 빠지고 들어오는 앞뒤 구간(각 0.6초)은 빨리, 가운데 카메라 이동 구간(진행 35~65%)은 1.4초
const FLIGHT_EDGE = 0.6
const FLIGHT_MOVE = 1.4
const FLIGHT_DUR = FLIGHT_EDGE * 2 + FLIGHT_MOVE
const fe = FLIGHT_EDGE / FLIGHT_DUR
// 진행 [p0, p1] 구간(카메라가 움직이는 부분)에 시간 비율 mid를 들이고, 앞뒤는 빨리 지나가는 이징
const slowMiddle = (p0, p1, mid) => {
  const e = (1 - mid) / 2
  const m = (p1 - p0) / mid
  const K = [[0, 0, 0], [e, p0, m], [1 - e, p1, m], [1, 1, 0]] // [시간, 진행, 기울기]
  return (x) => {
    const j = x < K[1][0] ? 0 : x < K[2][0] ? 1 : 2
    const [x0, y0, m0] = K[j]
    const [x1, y1, m1] = K[j + 1]
    const d = x1 - x0
    const t = (x - x0) / d
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * d * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * d * m1
  }
}
const easeFlight = slowMiddle(0.35, 0.65, 1 - 2 * fe)
// 5단계 → Why: 풍선이 올라가는 구간을 천천히 (앞뒤 카드 전환 각 0.7초, 상승 3.6초)
const ASCENT_DUR = 0.7 * 2 + 3.6
const easeAscent = slowMiddle((E - W * 0.5 - center(4)) / (WHY_STOP - center(4)), (E - W * 0.5 + 1.6 - center(4)) / (WHY_STOP - center(4)), 3.6 / ASCENT_DUR)
const pad = (n) => String(Math.round(n)).padStart(4, '0')

export default function Stage({ reduced, onReady }) {
  const root = useRef(null)
  const canvas = useRef(null)
  const meter = useRef(null)
  const needle = useRef(null)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const ocean = createOcean(canvas.current)
    const { S, L } = ocean
    const pin = root.current.querySelector('.stage-pin')

    // 화면 비율에 따라 카메라 거리·비켜서기 값
    const layout = () => {
      const w = pin.clientWidth
      const h = pin.clientHeight
      const aspect = w / h
      const m = mobile()
      return {
        m,
        dist: 8 * Math.min(2.1, Math.max(1, (m ? 0.78 : 1.25) / aspect)) * (m && h < 740 ? 1.12 : 1),
        side: m ? 0 : 0.2,
        up: m ? (aspect > 0.6 ? 0.12 : 0.17) : 0,
        heroX: m ? BUOY_X - 0.4 : 0,
        whyX: m ? BUOY_X : BUOY_X + 0.9,
      }
    }
    let lay = layout()
    const fit = () => {
      lay = layout()
      ocean.resize(pin.clientWidth, pin.clientHeight)
    }
    fit()
    Object.assign(S, { dist: lay.dist, camX: lay.heroX, shiftY: lay.up * 0.6 })

    // 렌더 루프 (스테이지가 화면에 있을 때만)
    let raf = 0
    let visible = true
    let first = true
    const target = { x: 0, y: 0 }
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!visible) return
      S.mx += (target.x - S.mx) * 0.05
      S.my += (target.y - S.my) * 0.05
      ocean.tick()
      const d = depthMeters(S.y)
      if (meter.current) meter.current.textContent = pad(d)
      if (needle.current) needle.current.style.setProperty('--d', Math.min(1, d / 4000))
      if (first) {
        first = false
        onReady?.()
      }
    }
    if (reduced) {
      Object.assign(S, { y: -5, pitch: 0.2, camX: 0, shiftY: 0 })
      ocean.tick()
      onReady?.()
      const onR = () => (fit(), Object.assign(S, { dist: layout().dist }), ocean.tick())
      window.addEventListener('resize', onR)
      return () => {
        window.removeEventListener('resize', onR)
        ocean.dispose()
      }
    }
    raf = requestAnimationFrame(loop)

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(root.current)
    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return
      target.x = (e.clientX / window.innerWidth - 0.5) * 2
      target.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove)

    const q = gsap.utils.selector(root.current)
    const panels = q('.panel')
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: root.current,
        start: 'top top',
        end: () => `+=${TOTAL * 62}%`,
        pin: pin,
        scrub: 0.4,
        invalidateOnRefresh: true,
      },
      onUpdate() {
        const t = this.time()
        let a = -1
        if (t >= T0 && t < E) a = Math.min(chapters.length - 1, Math.floor((t - T0) / CH))
        setActive((p) => (p === a ? p : a))
      },
    })

    // 히어로 → 수면 아래
    tl.to(q('.hero-veil'), { autoAlpha: 0, duration: 0.8 }, 0)
      .to(q('.hero'), { autoAlpha: 0, y: -40, duration: 0.7, ease: 'power1.in' }, 0.05)
      .to(q('.scroll-cue'), { autoAlpha: 0, duration: 0.3 }, 0)
      .to(S, { y: 0.6, pitch: -0.02, camX: 0, shiftY: () => lay.up * 0.3, duration: 0.8, ease: 'power1.in' }, 0)
      .to(S, { y: -5, pitch: 0.2, shiftY: 0, duration: 0.9, ease: 'power2.out' }, 0.8)
      .fromTo(q('.overview'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 1.2)
      .to(q('.overview'), { autoAlpha: 0, y: -30, duration: 0.4 }, T0 - 0.65)
      .fromTo(q('.gauge, .chapter-index'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 0.9)

    // 챕터 경계 b 기준 전환 구간 [b−W, b+W]을 셋으로 나눈다 — 카드와 카메라가 겹치지 않게
    //   [b−W, b−0.55W] 이전 카드 퇴장 → [b−0.6W, b+0.6W] 카메라 이동 → [b+0.55W, b+W] 새 카드 입장
    // 카드가 떠 있는 동안 카메라는 항상 멈춰 있다.
    panels.forEach((p, i) => {
      const b = T0 + i * CH
      const dir = i % 2 === 0 ? 1 : -1 // 짝수: 패널 왼쪽, 오브젝트 오른쪽
      const far = () => (FAR[i] ? Math.max(1, (lay.m ? FAR_M : FAR)[i] / lay.dist) : 1)
      const path = PATHS[i]
      if (path) {
        // 경로 비행: 카메라 이동 구간 [b−0.6W, b+0.6W] 안에서 키프레임을 차례로 지난다
        const R = LANDMARK_Z[1] // 수로는 소나 고원 기준 좌표
        const keys = path.keys.map(([z, up, look, abs]) => {
          const x = channelX(z - R)
          const floor = Math.max(terrainH(x - 0.8, z), terrainH(x, z), terrainH(x + 0.8, z))
          return { camX: x, y: (abs ?? floor + up) - Math.sin(look) * PATH_D, z: z - Math.cos(look) * PATH_D, look, far: () => PATH_D / lay.dist, pitch: 0, shiftX: 0, shiftY: 0 }
        })
        const total = W * 1.2
        const segs = path.segs
        tl.to(S, { keyframes: [...keys, { camX: 0, y: LANDMARK_Y[i], z: LANDMARK_Z[i], look: look(i), far, shiftX: () => lay.side * dir, shiftY: () => lay.up }].map((k, j) => ({ ...k, duration: total * segs[j], ease: j === 0 ? 'sine.in' : j === segs.length - 1 ? 'sine.out' : 'none' })) }, b - W * 0.6)
      } else {
        // 앞으로 먼저 나아가 절벽을 넘고(z), 뒤따라 내려간다(y)
        tl.to(S, { z: LANDMARK_Z[i], camX: 0, duration: W * 1.05 }, b - W * 0.6)
          .to(S, { y: LANDMARK_Y[i], look: look(i), far, duration: W * 1.05 }, b - W * 0.45)
          .to(S, { pitch: 0, shiftX: () => lay.side * dir, shiftY: () => lay.up, duration: W * 1.2 }, b - W * 0.6)
      }
      if (i === 4) {
        // 침몰선 → 인양: 같은 방식으로 탐사선을 따라 마지막 절벽을 내려간다
        tl.to(S, { rov2: 1, duration: W * 1.2, ease: 'sine.inOut' }, b - W * 0.6)
          .to(S, { follow: 1, duration: W * 0.3, ease: 'sine.inOut' }, b - W * 0.6)
          .to(S, { follow: 0, duration: W * 0.6, ease: 'sine.inOut' }, b)
      }
      if (i === 3) {
        // 탐사선 → 침몰선: 카메라가 탐사선 뒤에 붙어 절벽 끝까지 따라가고, 탐사선이 내려가는 동안 절벽 끝에 멈춰 내려다본다
        tl.to(S, { rov: 1, duration: W * 1.2, ease: 'sine.inOut' }, b - W * 0.6)
          .to(S, { follow: 1, duration: W * 0.3, ease: 'sine.inOut' }, b - W * 0.6)
          .to(S, { follow: 0, duration: W * 0.6, ease: 'sine.inOut' }, b)
      }
      // 카드: 이전 카드 퇴장 → 카메라 이동 → 새 카드 입장 (카드가 떠 있는 동안 카메라는 멈춰 있다)
      tl.fromTo(p, { autoAlpha: 0, x: () => (lay.m ? 0 : -50 * dir), y: () => (lay.m ? 30 : 0) }, { autoAlpha: 1, x: 0, y: 0, duration: W * 0.45, ease: 'power2.out' }, b + W * 0.55)
        .to(p, { autoAlpha: 0, x: () => (lay.m ? 0 : -30 * dir), y: () => (lay.m ? -20 : 0), duration: W * 0.45, ease: 'power2.in' }, b + CH - W)
        .to(L, { [i]: 1, duration: CH - W * 1.6, ease: 'none' }, b + W * 0.6)
    })

    // 다시 수면으로: Why
    // 인양 풍선과 함께 수면까지 곧장 올라간다 (풍선과 카메라가 같은 곡선으로 움직여 화면 안에 머문다)
    tl.to(S, { y: () => (lay.m ? -6.5 : -3.6), pitch: () => (lay.m ? 0.18 : 0.26), look: 0, far: () => (lay.m ? 1.15 : 1.45), camX: () => (lay.m ? (SURF.x + BUOY_X) / 2 : lay.whyX - 0.4), z: SURF.z + 1, shiftX: () => lay.side * -1, shiftY: () => lay.up, duration: 1.6, ease: 'power3.inOut' }, E - W * 0.5)
      .to(S, { lift: 1, duration: 1.6, ease: 'power3.inOut' }, E - W * 0.5)
      .to(q('.chapter-index'), { autoAlpha: 0, duration: 0.3 }, E - 0.1)
      .to(q('.gauge'), { autoAlpha: 0, duration: 0.4 }, WHY_IN - 0.2)
      .fromTo(q('.why'), { autoAlpha: 0, x: () => (lay.m ? 0 : 50), y: () => (lay.m ? 30 : 0) }, { autoAlpha: 1, x: 0, y: 0, duration: 0.6, ease: 'power2.out' }, WHY_IN)
      .fromTo(q('.why-point'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.15 }, WHY_IN + 0.3)
      .to({}, { duration: 0.01 }, TOTAL)

    // 타임라인 시간 t로 이동할 스크롤 위치 (내비·검증용)
    window.__stageAt = (t) => {
      const st = tl.scrollTrigger
      return st.start + (t / tl.duration()) * (st.end - st.start)
    }

    // ── 단계 스크롤: 휠 한 번 / 스와이프 한 번 = 다음 장면 하나 ──
    const st = tl.scrollTrigger
    const tAt = (y) => ((y - st.start) / (st.end - st.start)) * tl.duration()
    let busy = false // 이동 중
    let held = false // 이동 직후 관성 휠이 멎을 때까지 무시
    let lastWheel = 0
    let swipe = 0
    let queued = 0 // 이동 중에 들어온 다음 제스처 방향
    let fresh = false // 터치: 이번 손가락이 아직 단계를 넘기지 않았는지 (같은 스와이프의 나머지로 두 단계 넘어가지 않게)
    const SWIPE = 40 // 터치: 이만큼(px) 끌면 한 단계
    const NOTCH = 70 // 휠·트랙패드: 한 제스처에서 이만큼 굴려야 한 단계 (마우스 한 칸 ≈ 100)
    let wheelAcc = 0
    const targetOf = (dir) => {
      const t = tAt(window.scrollY)
      if (dir > 0) return STOPS.find((s) => s > t + 0.02)
      if (window.scrollY > st.end + 1) return undefined // 스테이지 아래(Works 등)는 일반 스크롤
      return [...STOPS].reverse().find((s) => s < t - 0.02)
    }
    const go = (to) => {
      const from = tAt(window.scrollY)
      // 인접한 챕터 사이 이동은 모두 같은 속도 배분으로
      const lo = Math.min(from, to)
      const flight = [1, 2, 3, 4].some((i) => lo > center(i - 1) - 0.1 && lo < center(i) - 0.1 && Math.abs(to - from) < CH + 0.2)
      const ascent = Math.abs(lo - center(4)) < 0.1 && Math.abs(Math.max(from, to) - WHY_STOP) < 0.1
      // 이웃한 정지점 사이 한 단계는 어디서든 같은 시간(챕터 사이 이동과 동일)으로: 히어로 → 개요 → 정어리도 포함
      const near = (t) => STOPS.reduce((a, s, k) => (Math.abs(s - t) < Math.abs(STOPS[a] - t) ? k : a), 0)
      const oneStep = Math.abs(near(from) - near(to)) === 1
      busy = held = true
      window.__lenis.scrollTo(window.__stageAt(to), {
        duration: ascent ? ASCENT_DUR : flight || oneStep ? FLIGHT_DUR : Math.min(2.4, 1.0 + 0.4 * Math.abs(to - from)),
        easing: ascent ? (to > from ? easeAscent : (x) => 1 - easeAscent(1 - x)) : flight ? easeFlight : ease3,
        lock: true,
        force: true,
        onComplete: () => {
          busy = false
          // 이동 중에 다음 제스처가 들어왔으면 이어서 한 단계 더
          const d = queued
          queued = 0
          const next = d ? targetOf(d) : undefined
          if (next !== undefined) go(next)
        },
      })
    }
    window.__stageStep = ({ deltaY, event }) => {
      const type = event.type
      const stop = () => (event.cancelable && event.preventDefault(), false)
      const wheel = type.includes('wheel')
      let quiet = true
      if (wheel) {
        // 이동 중에 들어온 휠도 기록해야 관성 꼬리가 다음 제스처로 오인되지 않는다
        const now = performance.now()
        quiet = now - lastWheel > 220
        lastWheel = now
        if (quiet) wheelAcc = 0
      }
      if (type === 'touchstart') {
        swipe = 0
        held = false
        fresh = true
        return busy ? stop() : true
      }
      if (type === 'touchend' || !deltaY) return busy ? stop() : true
      const dir = Math.sign(deltaY)
      if (busy) {
        // 이동 중 새 터치 스와이프는 버리지 않고 하나 예약해 둔다.
        // 휠은 예약하지 않는다: 트랙패드 관성 꼬리가 잠깐 끊겼다 이어지면 새 제스처로 오인돼 멈춘 뒤 혼자 한 단계 더 내려간다.
        if (!wheel && fresh && Math.abs((swipe += deltaY)) >= SWIPE) {
          queued = dir
          fresh = false
        }
        return stop()
      }
      if (held && (!wheel || !quiet)) return stop()
      held = false
      if (wheel && Math.abs((wheelAcc += deltaY)) < NOTCH) return targetOf(dir) === undefined ? true : stop() // 살짝 건드린 정도로는 넘어가지 않게
      const to = targetOf(dir)
      if (to === undefined) return true // 처음/마지막 정지점 바깥은 평소처럼 스크롤
      if (!wheel && (!fresh || Math.abs((swipe += deltaY)) < SWIPE)) return stop() // 짧은 터치는 모아서 판단
      fresh = false
      wheelAcc = 0
      go(to)
      return stop()
    }
    // 키보드·스크롤바로 어중간한 곳에 멈추면 가까운 정지점으로
    let idle = 0
    const onScroll = () => {
      clearTimeout(idle)
      idle = setTimeout(() => {
        if (busy || !window.__lenis || window.__noSnap) return // __noSnap: 검증 스크립트용
        const t = tAt(window.scrollY)
        if (t <= 0.01 || t >= STOPS.at(-1) - 0.01) return
        const near = STOPS.reduce((a, s) => (Math.abs(s - t) < Math.abs(a - t) ? s : a))
        if (Math.abs(near - t) > 0.03) go(near)
      }, 260)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const onResize = () => {
      fit()
      S.dist = lay.dist
    }
    window.addEventListener('resize', onResize)
    ScrollTrigger.addEventListener('refreshInit', onResize)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', onResize)
      ScrollTrigger.removeEventListener('refreshInit', onResize)
      tl.scrollTrigger?.kill()
      tl.kill()
      delete window.__stageAt
      delete window.__stageStep
      window.removeEventListener('scroll', onScroll)
      clearTimeout(idle)
      ocean.dispose()
    }
  }, [reduced, onReady])

  return (
    <section id="stage" ref={root} className={`stage${reduced ? ' reduced' : ''}`} aria-label="소개">
      <div className="stage-pin">
        <canvas ref={canvas} className="stage-canvas" aria-hidden="true" />
        <div className="stage-veil" aria-hidden="true" />
        <div className="stage-veil hero-veil" aria-hidden="true" />

        <header className="hero">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1 className="display">
            {hero.title.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </h1>
          <p className="hero-sub">{hero.sub}</p>
          <p className="hero-name">
            <strong>{profile.nameKo}</strong>
            <span>{profile.nameEn}</span>
          </p>
        </header>
        <div className="scroll-cue" aria-hidden="true">
          <span>{hero.scroll}</span>
          <i />
        </div>

        <div className="overview">
          <p className="label">{overview.label}</p>
          <p className="overview-text">
            {overview.lines.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </p>
        </div>

        {chapters.map((c, i) => (
          <article key={c.project} className={`panel glass ${i % 2 === 0 ? 'left' : 'right'}`} style={{ '--chars': Math.max(...c.line.map((l) => l.length)) }}>
            <p className="label">
              <span className="depth">−{c.depth.toLocaleString()} m</span>
              <span>{c.zone}</span>
            </p>
            <h2>
              {c.line.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </h2>
            <p className="project">
              <span className="dot" />
              {c.project}
            </p>
          </article>
        ))}

        <section className="why glass" aria-labelledby="why-title">
          <span id="why" className="anchor" />
          <p className="label">{why.label}</p>
          <h2 id="why-title" className="why-title">
            {why.title.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </h2>
          <ul>
            {why.points.map((p) => (
              <li key={p.k} className="why-point">
                <strong>{p.k}</strong>
                <span>{p.v}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="gauge" aria-hidden="true">
          <span className="gauge-k">DEPTH</span>
          <span className="gauge-v">
            −<b ref={meter}>0000</b>
            <small>m</small>
          </span>
          <span className="gauge-bar">
            <i ref={needle} />
          </span>
        </aside>

        <ol className="chapter-index" aria-hidden="true">
          {chapters.map((c, i) => (
            <li key={c.project} className={i === active ? 'on' : i < active ? 'past' : ''}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <em>{c.depth.toLocaleString()}m</em>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
