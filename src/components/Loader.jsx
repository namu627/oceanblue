import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

// 수위 게이지가 차오르는 로더. 3D 첫 프레임(ready)이 그려져야 100%.
const MIN_MS = 1700

export default function Loader({ ready, onDone }) {
  const [p, setP] = useState(0)
  const [start] = useState(() => performance.now())

  useEffect(() => {
    let raf
    const step = () => {
      const t = (performance.now() - start) / MIN_MS
      setP((cur) => {
        const cap = ready ? 100 : 88
        const goal = Math.min(cap, (ready ? Math.max(t, 0.6) : t) * 100)
        const next = cur + (goal - cur) * 0.12
        return Math.abs(goal - next) < 0.4 ? goal : next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [ready, start])

  useEffect(() => {
    if (p >= 100) {
      const id = setTimeout(onDone, 250)
      return () => clearTimeout(id)
    }
  }, [p, onDone])

  return (
    <motion.div
      className="loader"
      role="status"
      aria-label={`불러오는 중 ${Math.round(p)}%`}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.65, 0, 0.35, 1] } }}
    >
      <div className="loader-tank" style={{ '--p': p / 100 }}>
        <svg className="loader-wave" viewBox="0 0 240 20" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 10 Q 30 0 60 10 T 120 10 T 180 10 T 240 10 V20 H0Z" />
        </svg>
        <div className="loader-water" />
      </div>
      <div className="loader-meta">
        <span>SOUNDING</span>
        <b>{String(Math.round(p)).padStart(3, '0')}%</b>
      </div>
    </motion.div>
  )
}
