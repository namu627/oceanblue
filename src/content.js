// 사이트의 모든 문구·링크·프로젝트 데이터. 수정은 여기서만.

export const links = {
  email: '0627eric@naver.com',
  github: 'https://github.com/namu627',
  notion: 'https://app.notion.com/p/3e30f963b6ce805c9aeec8674642f23d',
}

export const profile = {
  nameKo: '남유찬',
  nameEn: 'YUCHAN NAM',
  school: '홍익대학교 세종 · 소프트웨어융합',
  minor: '빅데이터비즈니스 융합전공',
  status: '졸업학기 · 2027.02 졸업 예정',
}

export const hero = {
  eyebrow: 'OCEANBLUE · 서비스 기획 신입 지원',
  title: ['사용자가 다시 찾는 이유를', '설계합니다.'],
  sub: '깊이 생각하고, 끝까지 해내는 서비스 기획자',
  scroll: 'DIVE',
}

export const overview = {
  label: 'BELOW THE SURFACE',
  lines: ['사용자에겐 단순하게,', '그 아래에선 깊이 고민합니다.'],
}

// 수심 구간 = 챕터. depth는 화면에 표시되는 미터. line은 줄바꿈 단위 배열.
export const chapters = [
  {
    depth: 30,
    zone: 'SUNLIGHT ZONE',
    line: ['기준부터 세우고,', '한 방향으로 진행합니다.'],
    project: 'OptiMeal',
  },
  {
    depth: 200,
    zone: 'TWILIGHT ZONE',
    line: ['AI와 함께 일하되,', '마지막 판단은 제가 합니다.'],
    project: '별별 (my stella)',
  },
  {
    depth: 1000,
    zone: 'MIDNIGHT ZONE',
    line: ['처음 쓰는 도구도,', '빠르게 익혀 바로 활용합니다.'],
    project: '다온아이앤씨 드론 홍보영상',
  },
  {
    depth: 2400,
    zone: 'ABYSSAL ZONE',
    line: ['눈에 잘 띄지 않는 곳까지,', '꼼꼼하게 살핍니다.'],
    project: 'WiFi CSI Twin',
  },
  {
    depth: 4000,
    zone: 'THE DEEP',
    line: ['실패도 그냥 두지 않고,', '다음을 위한 재료로 삼습니다.'],
    project: 'MakeBlack',
  },
]

export const why = {
  label: 'WHY OCEANBLUE',
  title: ['다시 열게 만드는', '서비스를 만들겠습니다.'],
  points: [
    {
      k: '기획',
      v: '처음 쓰는 사람도 헤매지 않는 화면과 기능을 기획하겠습니다.',
    },
    {
      k: '성장',
      v: '이용 데이터에서 사용자가 머무는 이유와 떠나는 지점을 찾아 다음 개선안으로 잇겠습니다.',
    },
    {
      k: '운영',
      v: '고객 문의와 오류를 가장 먼저 듣고 운영 정책과 가이드로 정리하겠습니다.',
    },
  ],
}

// folder: src/assets/works/<folder> 이미지 자동 수집 / youtube: 영상 ID
// size: wide | tall | normal (벤토 그리드 크기)
export const works = [
  {
    title: 'OptiMeal',
    tag: '졸업 프로젝트 · 데이터 · 프론트엔드',
    desc: '연령·알레르기·질환·단가 조건을 맞춘 단체급식 식단표와 조리법을 60초 안에. 레시피 3,000개 정제와 DB 적재, 제철 식재료 빈도 분석, 입력부터 PDF까지 전체 흐름 점검을 맡았습니다. 목표에 못 미친 AI 기능은 원인을 분석해 대체안으로 바꿨습니다.',
    folder: 'optimeal',
    size: 'wide',
    actions: [{ label: 'GitHub', href: 'https://github.com/namu627/optimeal' }],
  },  {
    title: '별별 (my stella)',
    tag: '개인 앱 · 기획 · 운영 규칙 설계',
    desc: '실제 밤하늘의 별에 이름을 남기는 앱. 함께 등록 기능의 선점·만료·탈퇴 예외를 먼저 설계하고 AI 코딩 도구로 구현해 베타 테스트 중입니다.',
    folder: 'mystella',
    size: 'tall',
    actions: [{ label: 'Notion', href: links.notion }],
  },  {
    title: 'MakeBlack',
    tag: '개인 앱 · 기획 · 회고',
    desc: '할 일을 마칠수록 팔레트가 검게 물드는 투두 앱. 비공개 테스트까지 갔지만 보는 재미가 다시 쓸 이유가 되지 못해 접었습니다.',
    folder: 'makeblack',
    size: 'tall',
    actions: [{ label: 'GitHub', href: 'https://github.com/namu627/MakeBlack' }],
  },  {
    title: 'moodico',
    tag: '피로그래밍 23기 · 프론트엔드 · Figma',
    desc: '무드 기반 화장품 추천 서비스. 프론트엔드를 혼자 맡아 백엔드가 먼저 착수하도록 기능 프로토타입부터 넘겼고, 핵심 기능인 3D 컬러 매트릭스를 Figma로 설계해 CSS·JS만으로 구현했습니다.',
    youtube: 'Sbzhx7mM5Uc',
    size: 'normal',
    actions: [{ label: 'YouTube', href: 'https://youtu.be/Sbzhx7mM5Uc' }],
  },  {
    title: '드론 홍보영상',
    tag: '다온아이앤씨 일경험 · 생성형 AI',
    desc: '4인 팀에서 진행을 주도했습니다. AI 영상 도구 선정과 시나리오, 드론이 어색하게 나오던 문제 해결, 최종 편집까지 맡아 기업 승인을 받았습니다.',
    youtube: 'XWMsQnpBwzk',
    size: 'normal',
    actions: [{ label: 'YouTube', href: 'https://youtu.be/XWMsQnpBwzk' }],
  },  {
    title: 'WiFi CSI Twin',
    tag: '메타버스 아카데미 7기 · 진행 중',
    desc: 'WiFi 신호로 재난 현장 생존자를 탐지하는 프로젝트. 실험 공간을 cm 단위로 실측해 블렌더로 1:1 재현하고, 실측·가상 신호의 오차를 줄이는 중입니다.',
    folder: 'wificsi',
    size: 'normal',
    actions: [{ label: 'Notion', href: links.notion }],
  },]

export const contact = {
  label: 'SURFACE',
  title: ['자세한 기록은', 'Notion에 있습니다.'],
  sub: '프로젝트별 기획 문서, 판단 근거, 회고를 정리해 두었습니다.',
}

export const nav = [
  { label: 'Dive', href: '#stage' },
  { label: 'Why', href: '#why' },
  { label: 'Works', href: '#works' },
  { label: 'Contact', href: '#contact' },
]
