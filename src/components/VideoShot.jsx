import { useState } from 'react'

// 썸네일 + 재생 버튼 → 클릭 시 youtube-nocookie iframe
export default function VideoShot({ id, title }) {
  const [play, setPlay] = useState(false)
  return (
    <div className="shot video">
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" className="video-poster" onClick={() => setPlay(true)} aria-label={`${title} 영상 재생`}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="play">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
          </span>
        </button>
      )}
    </div>
  )
}
