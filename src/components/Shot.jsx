import { useEffect, useRef, useState } from 'react'

// 이미지 0장=자리표시, 1장=정지, 2장+=슬라이드(자동·스와이프·화살표·점·키보드)
export default function Shot({ images, alt, tall }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const touch = useRef(null)
  const n = images.length

  useEffect(() => {
    if (n < 2 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setI((v) => (v + 1) % n), 3600)
    return () => clearInterval(id)
  }, [n, paused])

  if (!n) return <div className="shot shot-empty">{alt}</div>

  const go = (d) => setI((v) => (v + d + n) % n)

  return (
    <div
      className={`shot${tall ? ' tall' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        touch.current = null
      }}
    >
      {images.map((src, k) => (
        <div key={src} className={`shot-slide${k === i ? ' on' : ''}`} aria-hidden={k !== i}>
          {tall && <img className="shot-bg" src={src} alt="" aria-hidden="true" />}
          <img className="shot-img" src={src} alt={`${alt} 화면 ${k + 1}`} loading="lazy" decoding="async" />
        </div>
      ))}
      {n > 1 && (
        <>
          <button type="button" className="shot-nav prev" onClick={() => go(-1)} aria-label="이전 이미지">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" className="shot-nav next" onClick={() => go(1)} aria-label="다음 이미지">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <div className="shot-dots">
            {images.map((src, k) => (
              <button key={src} type="button" className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`${k + 1}번 이미지`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
