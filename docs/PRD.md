# 혼밥 신호등 — MVP 요구사항 정의서 v1.0

문서를 그대로 레포의 `docs/PRD.md`로 커밋하고, 에이전트에게 "이 문서를 스펙으로 삼아라"고 지시하는 걸 전제로 작성했습니다. 그래서 모호한 표현 대신 판정 규칙과 수용 기준을 숫자로 못박아뒀어요.

---

## 1. 개요

**한 줄 정의** — 회사 근처 식당을, 점심에 혼자 가도 되는지와 지금 줄이 있는지 기준으로 신호등 색 하나로 보여주는 사내용 웹앱.

**해결하는 문제** — 기존 지도·맛집 앱은 맛과 가격은 알려주지만 "혼자 들어가도 되는가", "12시에 줄 서는가"를 알려주지 않는다. 이 두 정보 때문에 매일 점심마다 탐색 비용이 발생한다.

**핵심 사용자** — 점심을 혼자 먹는 사내 구성원. 초기 규모 20~50명.

**성공 기준 (런칭 후 2주)** — 주간 재방문 사용자 10명 이상, 실시간 웨이팅 제보 누적 30건 이상. 이 둘이 안 나오면 기능을 늘리지 말고 데이터 품질부터 점검한다.

**설계 원칙** — "12시 5분, 혼자, 어디 갈까"에 3초 안에 답하지 못하게 만드는 기능은 전부 범위 밖이다.

---

## 2. 범위

포함하는 것은 식당 목록과 상세 조회, 신호등 자동 판정, 실시간 웨이팅 원탭 제보, 필터 두 종, PWA 홈 화면 추가까지다.

제외하는 것은 회원가입과 로그인, 텍스트 리뷰와 별점, 사진 업로드, 관리자 페이지, 푸시 알림, 즐겨찾기, 지도 임베드, 다국어다. 데이터 입력은 Supabase 테이블 에디터에서 사람이 직접 한다. 에이전트가 "관리자 CRUD 화면도 만들까요?"라고 물으면 거절한다.

---

## 3. 도메인 규칙 (가장 중요 — 순수 함수로 구현)

### 3.1 상태 값 정의

```
SoloStatus  = 'green' | 'yellow' | 'red'
  green  : 1인석/바석 있음. 혼자 가도 안내 즉시 됨
  yellow : 1인석은 없으나 테이블 혼자 사용 허용. 눈치 요소 있음
  red    : 평일 점심 피크에 1인 입장 거절 또는 합석 강제

WaitLevel   = 0 | 5 | 15 | null
  0    : 대기 없음 (바로 착석)
  5    : 5~10분
  15   : 15분 이상
  null : 정보 없음

SignalColor = 'green' | 'yellow' | 'red' | 'gray'
  gray : 휴무일이거나 영업시간 외
```

### 3.2 웨이팅 상태 결정 순서

1. 유효한 실시간 제보가 있으면 최우선. 유효 조건은 `created_at`이 현재 시각 기준 90분 이내. 여러 건이면 **가장 최근 3건의 최댓값**을 쓴다(평균이 아니라 최댓값 — 과소평가로 헛걸음하는 비용이 과대평가보다 크다).
2. 제보가 없으면 시각대별 기본값을 쓴다. `11:30~12:14`는 `wait_1200`, `12:15~13:00`은 `wait_1230`.
3. 위 시간대 밖이면 `WaitLevel = null`로 두고, UI에 "점심시간 기준 정보"라고 표기한다.

### 3.3 최종 색 판정

휴무일이면 다른 조건과 무관하게 `gray`. 그 외에는 혼밥 색과 웨이팅 색 중 **더 나쁜 쪽**을 채택한다.

| 혼밥 \ 웨이팅 | 0분 | 5~10분 | 15분+ | 정보없음 |
|---|---|---|---|---|
| green |  |  |  |  |
| yellow |  |  |  |  |
| red |  |  |  |  |

`solo_status = 'red'`는 어떤 경우에도 초록이 될 수 없다. 웨이팅 정보가 없을 때는 혼밥 색만으로 판정하되 라벨에 반드시 "웨이팅 정보 없음"을 노출한다.

이 로직은 `lib/signal.ts`의 순수 함수 `getSignal(restaurant, reports, now): { color, label, reason }`로 분리하고, 위 표 전체를 커버하는 단위 테스트를 **구현보다 먼저** 작성한다. 에이전트가 가장 흔히 틀리는 지점이 시간대 경계와 우선순위이므로 여기만큼은 테스트를 강제한다.

---

## 4. 데이터 모델

```sql
create table restaurants (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,              -- 한식 / 일식 / 중식 / 양식 / 분식 / 카페
  walk_min     int  not null,              -- 회사 정문 기준 도보 분
  price_min    int  not null,              -- 1인 점심 최저가
  price_max    int  not null,
  solo_status  text not null check (solo_status in ('green','yellow','red')),
  solo_note    text,                       -- "바 4석, 12시 넘으면 만석"
  wait_1200    int  check (wait_1200 in (0,5,15)),
  wait_1230    int  check (wait_1230 in (0,5,15)),
  order_type   text check (order_type in ('kiosk','table_tablet','staff_call')),
  self_bar     boolean default false,      -- 물/반찬 셀프 여부
  noise_level  int check (noise_level between 1 and 3),  -- 1 조용 3 시끌
  staff_talk   int check (staff_talk between 1 and 3),   -- 1 무관심 3 말 많음
  signature    text,                       -- 대표 메뉴
  closed_days  int[] default '{}',         -- 0=일 ~ 6=토
  open_time    time default '11:00',
  close_time   time default '21:00',
  kakaomap_url text,
  photo_url    text,
  updated_at   timestamptz default now()
);

create table wait_reports (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  level         int  not null check (level in (0,5,15)),
  device_id     text not null,             -- 클라이언트 localStorage UUID
  created_at    timestamptz default now()
);
create index on wait_reports (restaurant_id, created_at desc);
```

**RLS 정책은 반드시 명시한다.** anon key는 브라우저에 노출되므로, `restaurants`는 `select`만 허용하고 `insert/update/delete`는 전부 차단한다. `wait_reports`는 `insert`와 최근 90분 `select`만 허용하고 `update/delete`는 차단한다. 에이전트가 RLS를 끄고 넘어가는 경우가 잦으니 프롬프트에 명시적으로 넣을 것.

**중복 제보 방지** — 동일 `device_id`가 동일 식당에 10분 이내 재제보하면 클라이언트에서 버튼을 비활성화한다. 서버 검증까지는 MVP에서 하지 않는다.

---

## 5. 화면 명세

### 5.1 목록 (`/`)

상단에 현재 시각과 "지금 12:05 기준" 문구를 고정 노출한다. 그 아래 필터 토글 두 개, 즉 "혼밥 가능만"(red 제외)과 "웨이팅 없는 곳만"(최종 색 green만). 두 토글은 AND로 동작하고 URL 쿼리스트링에 반영해 공유 가능하게 한다.

카드 한 장에는 신호등 색 원(도형 구분 포함), 가게명, 카테고리, 도보 N분, 가격대, 그리고 판정 이유 한 줄("1인석 있음 · 웨이팅 없음")이 들어간다. 유효한 실시간 제보가 있으면 "N분 전 제보" 뱃지를 추가한다.

기본 정렬은 신호등 색 우선(green → yellow → red → gray), 동일 색 내에서는 도보 거리 오름차순.

### 5.2 상세 (`/r/[id]`)

상단에 큰 신호등과 판정 이유. 바로 아래 **"지금 웨이팅 어때요?"** 버튼 3개(없음 / 5~10분 / 15분 이상). 탭 즉시 낙관적 업데이트로 반영하고 토스트로 "제보 감사합니다"를 띄운다. 로그인·입력·확인 다이얼로그 없음.

그 아래 혼밥 정보(1인석 여부, `solo_note`, 주문 방식, 셀프바), 분위기(소음, 직원 말 걸기), 기본 정보(대표 메뉴, 가격, 영업시간, 휴무), 카카오맵 링크 순으로 배치한다.

---

## 6. 비기능 요구사항

모바일 우선으로 375px 기준 설계하고 데스크톱은 최대 폭 640px 중앙 정렬이면 충분하다. 목록 첫 화면은 4G에서 LCP 2.5초 이내를 목표로 하며, 식당 데이터는 서버 컴포넌트에서 가져오되 실시간 제보만 클라이언트에서 갱신한다.

접근성은 색상 단독 전달을 금지한다. 색 + 도형(● ▲ ■ ○) + 텍스트 라벨을 항상 함께 제공하고, 신호등 요소에 `aria-label`을 붙인다. 적록색약 사용자가 20명 팀이면 통계적으로 한 명은 있다.

PWA는 `manifest.json`, 512/192 아이콘, `theme-color`, `apple-touch-icon`까지만 한다. 서비스 워커와 오프라인 캐싱은 MVP 범위 밖이다.

---

## 7. 기술 스택

Next.js 15 App Router와 TypeScript, Tailwind, Supabase(Postgres + RLS), Vercel 배포. 상태관리 라이브러리와 컴포넌트 라이브러리는 도입하지 않는다. 테스트는 Vitest로 `lib/signal.ts`만 커버한다.

---

## 8. 수용 기준

목록 화면에서 필터를 켜고 끄는 동안 색 판정이 3.3의 표와 100% 일치해야 한다. 11:29와 11:30, 12:14와 12:15, 13:00과 13:01 경계에서 기본값 선택이 규칙대로 바뀌어야 한다. 제보 후 새로고침해도 90분간 유지되고 91분째에는 사라져야 한다. 휴무 요일에는 gray로 표시되며 필터 결과에서 후순위로 밀려야 한다. anon key로 `restaurants` 테이블에 insert를 시도하면 실패해야 한다. 시드 데이터 최소 8곳 이상이 채워진 상태로 배포되어야 한다.

---

## 9. AI 에이전트 작업 분할

한 번에 다 시키면 신호등 로직이 조용히 틀어진 채로 완성됩니다. 순서를 이렇게 끊으세요.

1단계는 프로젝트 초기화와 Supabase 스키마 및 RLS 적용, 그리고 시드 스크립트. 2단계는 `lib/signal.ts` 테스트 먼저 작성 후 구현, 여기서 3.3 표 전부 통과할 때까지 다음으로 넘어가지 않기. 3단계는 목록 화면과 필터. 4단계는 상세 화면과 제보 기능. 5단계는 PWA 매니페스트와 배포.

프롬프트에는 매번 "docs/PRD.md의 3장 판정 규칙을 그대로 따르고, 규칙에 없는 동작은 임의로 추가하지 말 것"과 "범위 밖 기능(2장)을 제안하지 말 것"을 넣어주세요. 에이전트는 친절하게 로그인 기능을 얹어주는 경향이 있습니다.

---

가장 먼저 필요한 건 데이터입니다. 코드는 하루면 나오는데 식당 20곳 조사가 실제 병목이에요. 시드 CSV 템플릿을 열별 예시와 함께 만들어드릴까요, 아니면 1단계 에이전트 프롬프트부터 짜드릴까요?
