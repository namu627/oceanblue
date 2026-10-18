import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Stage from './three/Stage.jsx'
import { STAGE_TIMES } from './three/timeline.js'
import Loader from './components/Loader.jsx'
import Shot from './components/Shot.jsx'
import VideoShot from './components/VideoShot.jsx'
import { links, profile, works, contact, nav } from './content.js'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

// src/assets/works/<폴더>/ 이미지 자동 수집 (파일명 순서 = 슬라이드 순서)
const files = import.meta.glob('./assets/works/*/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })
const gallery = {}
for (const path of Object.keys(files).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
  const folder = path.split('/').at(-2)
  ;(gallery[folder] ??= []).push(files[path])
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  )
}

export default function App() {
  const [reduced] = useState(reducedMotion)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const lenis = useRef(null)
  const logo = useRef(null)
  const onReady = useCallback(() => setReady(true), [])
  const onDone = useCallback(() => setLoading(false), [])

  // 로딩 중엔 스크롤 잠금
  useEffect(() => {
    document.documentElement.classList.toggle('locked', loading)
    if (loading) window.scrollTo(0, 0)
    else ScrollTrigger.refresh()
  }, [loading])

  useEffect(() => {
    if (reduced) return
    // 스테이지 구간의 휠·스와이프는 Stage가 단계 이동으로 가로챈다 (window.__stageStep)
    const l = new Lenis({ lerp: 0.09, smoothWheel: true, virtualScroll: (d) => window.__stageStep?.(d) ?? true })
    lenis.current = l
    window.__lenis = l
    l.on('scroll', ScrollTrigger.update)
    const raf = (time) => l.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(raf)
      l.destroy()
      delete window.__lenis
    }
  }, [reduced])

  // 로고: 맨 위에선 NamYuchan, 내려가면 N—Y 로 접힘
  useEffect(() => {
    const el = logo.current
    const st = ScrollTrigger.create({
      start: 120,
      onToggle: (self) => gsap.to(el, { '--x': self.isActive ? 0 : 1, duration: 0.6, ease: 'power3.inOut' }),
    })
    return () => st.kill()
  }, [])

  const go = (e, href) => {
    e.preventDefault()
    let y
    if (href === '#stage' || href === '#top') y = href === '#top' ? 0 : window.__stageAt?.(STAGE_TIMES.dive)
    else if (href === '#why') y = window.__stageAt?.(STAGE_TIMES.why)
    const target = y ?? document.querySelector(href)
    if (lenis.current) lenis.current.scrollTo(target ?? 0, { duration: 1.6 })
    else if (typeof target === 'number') window.scrollTo({ top: target })
    else target?.scrollIntoView()
  }

  return (
    <>
      <AnimatePresence>{loading && <Loader key="loader" ready={ready} onDone={onDone} />}</AnimatePresence>

      <a className="skip" href="#works">
        본문으로 건너뛰기
      </a>

      <header className="topbar">
        <a href="#top" className="logo" ref={logo} onClick={(e) => go(e, '#top')} aria-label="남유찬 — 처음으로">
          N<span className="logo-x">am</span>
          <span className="logo-dash" />Y<span className="logo-x">uchan</span>
        </a>
        <nav className="menu" aria-label="주요 메뉴">
          {nav.map((n) => (
            <a key={n.href} href={n.href} onClick={(e) => go(e, n.href)}>
              {n.label}
            </a>
          ))}
        </nav>
        <a className="btn btn-ghost notion" href={links.notion} target="_blank" rel="noreferrer">
          Notion <Arrow />
        </a>
      </header>

      <main id="top">
        <Stage reduced={reduced} onReady={onReady} />

        <section id="works" className="works">
          <div className="section-head">
            <p className="label">SELECTED WORKS</p>
            <h2 className="section-title">
              주요 프로젝트
            </h2>
          </div>
          <div className="bento">
            {works.map((w) => (
              <article key={w.title} className={`card ${w.size}`}>
                {w.youtube ? (
                  <VideoShot id={w.youtube} title={w.title} />
                ) : (
                  <Shot images={gallery[w.folder] ?? []} alt={w.title} tall={w.size === 'tall'} />
                )}
                <div className="card-body">
                  <h3>{w.title}</h3>
                  <div className="card-actions">
                    {w.actions.map((a) => (
                      <a key={a.label} className="btn btn-ghost" href={a.href} target="_blank" rel="noreferrer">
                        {a.label} <Arrow />
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="contact">
          <div className="contact-inner">
            <p className="label">{contact.label}</p>
            <h2 className="section-title">
              {contact.title.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </h2>
            <p className="contact-sub">{contact.sub}</p>
            <a className="btn btn-primary" href={links.notion} target="_blank" rel="noreferrer">
              Notion 포트폴리오 열기 <Arrow />
            </a>
            <dl className="contact-grid">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${links.email}`}>{links.email}</a>
                </dd>
              </div>
              <div>
                <dt>GitHub</dt>
                <dd>
                  <a href={links.github} target="_blank" rel="noreferrer">
                    github.com/namu627
                  </a>
                </dd>
              </div>
              <div>
                <dt>Education</dt>
                <dd>
                  {profile.school}
                  <br />
                  {profile.minor}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{profile.status}</dd>
              </div>
            </dl>
          </div>
          <footer className="foot">
            <span>© 2026 {profile.nameEn}</span>
            <span>Made for OCEANBLUE · Service Planning</span>
          </footer>
        </section>
      </main>
    </>
  )
}
