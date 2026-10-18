import { chapters } from '../content.js'

// 스테이지 타임라인 시간 단위
export const T0 = 3 // 첫 챕터 경계
export const CH = 2.4 // 챕터 길이
export const W = 0.6 // 경계 앞뒤 전환 폭
export const E = T0 + chapters.length * CH // 마지막 챕터 끝 = 상승 시작
export const WHY_IN = E + 1
export const TOTAL = E + 3
export const WHY_STOP = WHY_IN + 1.2 // Why 패널과 항목이 다 나온 시점
export const center = (i) => T0 + i * CH + CH / 2 // 챕터 i 카드가 떠 있는 구간의 가운데
// 단계 스크롤 정지점: 히어로 → 개요 → 챕터 1..5 → Why
export const STOPS = [0, T0 - 0.9, ...chapters.map((_, i) => center(i)), WHY_STOP]
export const STAGE_TIMES = { dive: center(0), why: WHY_STOP }
