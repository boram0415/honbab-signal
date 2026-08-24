# 혼밥 신호등 개발 히스토리

최종 업데이트: 2026-08-21

이 문서는 다른 AI 에이전트가 현재 작업 상태를 추측 없이 이어받을 수 있도록 작성한 인수인계 기록이다. 제품 요구사항의 유일한 기준은 [`docs/PRD.md`](./PRD.md)이며, 이 문서와 충돌할 경우 PRD를 우선한다.

## 1. 현재 작업 범위

사용자가 요청한 1단계만 작업했다.

- Next.js 15 프로젝트 초기 파일 구성
- TypeScript strict 및 Tailwind CSS 설정
- PRD 3.1 타입 정의
- Supabase 테이블, 인덱스, RLS 마이그레이션 작성
- CSV 기반 식당 시드 스크립트 작성
- anon key의 `restaurants` INSERT 차단 검사 스크립트 작성
- 로컬 실행 절차 README 작성

다음 항목은 의도적으로 구현하지 않았다.

- 화면 및 UI 컴포넌트. 단, `app/page.tsx`에는 요청대로 `혼밥 신호등` 텍스트 플레이스홀더만 있다.
- `lib/signal.ts` 및 신호등 판정 로직
- 판정 로직 테스트
- 목록, 상세, 필터, 웨이팅 제보 기능
- PWA 설정 및 배포
- PRD 2장의 범위 밖 기능

## 2. 프로젝트 위치

프로젝트 루트:

```text
C:\Users\user-pc\honbab-signal
```

최초 작업 위치인 `C:\Users\user-pc`에는 Git 저장소가 없었다. 사용자의 확인을 받은 뒤 위 경로에 새 프로젝트 파일을 생성했다.

## 3. 생성된 파일

```text
honbab-signal/
├─ .env.local.example
├─ .gitignore
├─ README.md
├─ next-env.d.ts
├─ next.config.ts
├─ package.json
├─ postcss.config.js
├─ tailwind.config.ts
├─ tsconfig.json
├─ app/
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ data/
│  └─ restaurants.csv
├─ docs/
│  ├─ PRD.md
│  └─ DEVELOPMENT_HISTORY.md
├─ lib/
│  └─ types.ts
├─ scripts/
│  ├─ check-rls.ts
│  └─ seed.ts
└─ supabase/
   └─ migrations/
      └─ 0001_init.sql
```

## 4. 구현 내용

### 프로젝트 설정

- Next.js 15 App Router, React 19, TypeScript strict 설정
- Tailwind CSS 3 및 PostCSS 설정
- 추가 패키지는 `@supabase/supabase-js`, `vitest`, `tsx`, `csv-parse`, `dotenv`로 제한
- `app/layout.tsx`의 본문을 최대 폭 640px로 중앙 정렬
- `.env*.local`을 `.gitignore`에 포함

### 타입

`lib/types.ts`에 아래 타입을 정의했다.

- `SoloStatus`
- `WaitLevel`
- `SignalColor`
- `Restaurant`
- `WaitReport`

DB에서 nullable인 컬럼은 TypeScript에서도 `null`을 허용한다. 시간 및 timestamptz 값은 Supabase JSON 응답 형태를 고려해 `string`으로 정의했다.

### 데이터베이스

`supabase/migrations/0001_init.sql`에 PRD의 두 테이블과 인덱스를 작성했다.

- `restaurants`
- `wait_reports`
- `(restaurant_id, created_at desc)` 인덱스
- 시드 재실행을 위한 `restaurants.name` UNIQUE 제약
- 두 테이블 모두 RLS 활성화
- anon은 `restaurants` SELECT만 허용
- anon은 `wait_reports` INSERT 허용
- anon은 최근 90분의 `wait_reports` SELECT만 허용
- anon UPDATE/DELETE 정책은 작성하지 않아 차단

### 시드

`scripts/seed.ts`는 `.env.local`을 읽고 service role key로 `data/restaurants.csv`를 처리한다.

- CSV의 따옴표 필드와 필드 내부 쉼표 지원
- `closed_days`의 세미콜론 구분값을 `int[]`로 변환
- `self_bar`를 boolean으로 변환
- 빈 웨이팅 값을 `null`로 변환
- 요구된 행 단위 검증 및 오류 행 번호 출력
- 유효 행만 `name` 기준 upsert
- `성공 N건 / 실패 M건` 요약 출력

현재 `data/restaurants.csv`에는 헤더만 있다. 실제 식당 데이터는 제공되지 않았으므로 임의의 식당을 만들지 않았다. PRD의 배포 수용 기준인 최소 8곳은 아직 충족하지 않는다.

### RLS 검사

`scripts/check-rls.ts`는 anon key로 `restaurants` INSERT를 시도한다.

- RLS 또는 권한 오류이면 성공으로 판정
- INSERT가 예상과 달리 성공하면 service role로 테스트 행을 삭제한 뒤 실패 처리
- 네트워크 및 기타 오류를 RLS 성공으로 오인하지 않도록 오류 메시지를 구분

`SUPABASE_SERVICE_ROLE_KEY`는 `scripts/`에서만 참조하며 `app/`과 `lib/`에서는 참조하지 않는다.

## 5. 아직 수행하지 못한 검증

아래 명령은 아직 완료되지 않았다.

```bash
npm install
npm run typecheck
npm run build
npm run dev
npx tsx scripts/seed.ts
npx tsx scripts/check-rls.ts
```

이유:

- Windows 샌드박스가 프로세스 생성 중 `SetTokenInformation(TokenDefaultDacl) failed: 1344` 오류를 반복했다.
- 우회 실행 승인 과정이 중단되어 Git 초기화와 npm 설치까지 진행되지 않았다.
- 실제 Supabase URL 및 키가 제공되지 않아 시드와 RLS 통합 검증은 원래도 실행할 수 없는 상태다.

따라서 현재 상태를 “빌드 완료” 또는 “완료 조건 충족”으로 보고하면 안 된다.

## 6. Git 상태

`git init` 실행을 시도했지만 샌드박스 오류 후 승인 실행이 중단됐다. Git 저장소가 실제로 초기화됐는지 다음 에이전트가 먼저 확인해야 한다.

```bash
git rev-parse --show-toplevel
```

커밋은 생성하지 않았다.

## 7. PRD 검토 중 발견한 결정 필요 사항

### 3.3 최종 색 판정표가 비어 있음

PRD는 “혼밥 색과 웨이팅 색 중 더 나쁜 쪽”을 사용한다고 쓰지만, `WaitLevel`별 웨이팅 색 대응을 정의하지 않았고 3.3 표의 모든 결과 셀이 비어 있다. 따라서 2단계의 테스트와 `getSignal` 구현을 시작하기 전에 사용자가 12개 조합의 기대 색을 확정해야 한다. 임의로 `0=green`, `5=yellow`, `15=red`라고 가정하면 안 된다.

### 영업시간 외 판정과 3.2 문구의 관계

`SignalColor.gray` 설명에는 영업시간 외가 포함되지만 3.3 첫 문장은 휴무일만 우선 조건으로 명시한다. 2단계에서는 영업시간 외에도 항상 gray인지 확인이 필요하다.

### 90분 경계

PRD 3.2와 RLS 요구는 `created_at`이 현재 시각 기준 90분 이내라고 설명하면서 SQL 조건은 `created_at > now() - interval '90 minutes'`로 지정했다. 정확히 90분 전은 제외되는 조건이다. 테스트에서는 지정된 SQL의 엄격한 `>` 조건과 91분째 소멸 수용 기준을 함께 확인해야 한다.

### CSV 데이터

실제 식당 데이터와 회사 기준 위치가 제공되지 않았다. `walk_min`, 가격, 혼밥 상태, 웨이팅 기본값을 추측하지 말고 사용자에게 데이터를 받아야 한다.

## 8. 다음 에이전트 권장 순서

1. `C:\Users\user-pc\honbab-signal`에서 Git 저장소 여부와 파일 상태를 읽기 전용으로 확인한다.
2. `package.json`과 생성 소스를 검토한 뒤 `npm install`을 실행한다.
3. `npm run typecheck`와 `npm run build`를 실행하고 오류가 있으면 1단계 범위 안에서만 최소 수정한다.
4. `npm run dev`가 기동되는지 확인한다.
5. 사용자가 Supabase 자격증명과 적용된 프로젝트를 제공하면 마이그레이션 적용 여부를 확인하고 시드 및 RLS 검사 스크립트를 실행한다.
6. 실제 식당 CSV 데이터를 받아 최소 8곳 수용 기준을 확인한다.
7. 2단계로 넘어가기 전에 PRD 3.3의 빈 판정표를 사용자에게 확정받는다.

화면, 컴포넌트, 신호등 판정 로직은 사용자가 2단계를 명시적으로 요청하기 전까지 구현하지 않는다.

## 9. 1단계 검증 결과 (2026-08-21 이어서 수행)

이전 세션에서 미완료였던 설치·빌드·기동 검증을 실제로 실행했다. 소스 파일은 수정하지 않았고, 검증에 필요한 명령만 수행했다.

### 실행 환경

- Node.js v24.16.0, npm 11.13.0
- 이전 세션에서 보고된 `SetTokenInformation` 샌드박스 오류는 이번 실행에서 재현되지 않았다.

### 실행한 명령과 결과

- `git rev-parse --show-toplevel` → 저장소 아님 확인 후 `git init` 실행. 커밋은 생성하지 않았다.
- `npm install` → 성공. 160개 패키지 설치. `npm audit`에서 high 3건 보고됨(수정 명령은 실행하지 않음. 요청 범위 밖).
- `npm run typecheck` (`tsc --noEmit`) → **통과 (exit 0)**.
- `npm run build` (`next build`) → **성공**. `/`와 `/_not-found` 정적 프리렌더. First Load JS 103 kB.
- `npm run dev` → 기동 성공. `http://localhost:3000` 응답 **HTTP 200** 확인 후 서버 종료.

### Supabase 연동 및 DB 적용 (같은 세션에서 이어서 완료)

사용자가 Supabase 프로젝트를 생성하고 자격증명을 제공하여 아래를 완료했다.

- 프로젝트 ref: `jnbpjgkmohbjcjunfcjf` (URL `https://jnbpjgkmohbjcjunfcjf.supabase.co`)
- `.env.local` 생성: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 설정 (gitignore 대상, 커밋 안 됨).
- **마이그레이션 적용**: `supabase/migrations/0001_init.sql` 내용을 Supabase 웹 SQL Editor에서 실행. `restaurants`, `wait_reports` 테이블 및 인덱스, RLS 정책 생성 완료. (CLI/psql 미사용 — service_role만으로는 DDL 실행 불가하여 SQL Editor 사용)
- **스키마 검증**: service_role로 두 테이블의 컬럼(`solo_status`, `wait_1200`, `closed_days`, `level` 등) 조회 성공.
- **RLS 검증 (`npm run check:rls`)**: ✅ **통과** — anon key의 `restaurants` INSERT가 거부됨.
- **RLS 읽기 정책 추가 확인**: anon key로 `restaurants` SELECT 허용됨, `wait_reports` SELECT 허용됨. (앱이 목록을 읽을 수 있음을 확인)

> 주의: 마이그레이션 최초 실행 시 SQL Editor에 이전 텍스트가 남아 `price_max specified more than once` 등 오류 발생. 에디터를 비우고 `drop table if exists` 포함 버전으로 재실행하여 해결.

> 보안: service_role 키가 채팅에 노출되어 사용자에게 rotate 권고함. (미확인 — 사용자 조치 필요)

### 시드 (데모 데이터로 완료)

사용자 요청으로 웹 검색(문정동/문정역 일대)을 기반으로 **데모용 식당 9곳**을 `data/restaurants.csv`에 작성하고 시드했다.

- `npm run seed` → **성공 9건 / 실패 0건**. DB 재조회로 9곳 및 한글 저장 정상 확인.
- 색 분포: green 5, yellow 3, red 1 (2단계 신호등 로직 테스트용으로 섞음).
- PRD 8장 수용 기준(최소 8곳) 충족.

⚠️ **데이터 신뢰도 경고**: 식당 **이름/카테고리/대표메뉴/대략 가격대**는 웹 검색 기반이나, **`solo_status`(혼밥 가능여부)/`walk_min`/`wait_1200`/`wait_1230`/`noise_level`/`staff_talk`는 실제 조사값이 아니라 데모용 임의값**이다. 실서비스 전 실제 현장 조사값으로 교체해야 한다.

- 1번째 행(탕화쿵푸 문정동점)은 사용자가 제공한 `Downloads/데이터.csv` 원본을 기반으로 하되, 검증 통과를 위해 사용자 확인을 받아 값을 보정함: `order_type` self→`staff_call`, `noise_level` 0→2, `staff_talk` 0→1, `self_bar` TRUE→`true`.
- `data/restaurants.csv`의 선택 컬럼(`closed_days`, `open_time`, `close_time`, `kakaomap_url`, `photo_url`)은 비워 둠 → 시드 시 기본값(휴무 없음, 11:00~21:00) 적용.

### 소스 점검 결과

`package.json`, `tsconfig.json`(strict), `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `app/*`, `lib/types.ts`, `scripts/*`, `supabase/migrations/0001_init.sql`을 검토했다. 1단계 요구사항과 일치하며 수정이 필요한 오류는 없었다. 따라서 이번 세션에서 변경한 소스 파일은 없다.

## 10. 2단계(신호등 로직) + 목록 화면 (같은 세션에서 이어서 완료)

사용자가 "화면을 보고 싶다"고 요청하여 2단계와 목록 화면(3단계 일부)을 함께 구현했다.

### PRD 3.3 판정표 — 사용자 확정

빈 판정표를 사용자에게 확정받았다. 웨이팅 색 매핑 `0분=green / 5~10분=yellow / 15분+=red`, 최종 색은 "혼밥 색과 웨이팅 색 중 더 나쁜 쪽". 결과:

| 혼밥＼웨이팅 | 0분 | 5~10분 | 15분+ | 정보없음 |
|---|---|---|---|---|
| green | green | yellow | red | green |
| yellow | yellow | yellow | red | yellow |
| red | red | red | red | red |

영업시간 밖 처리도 확정: **휴무일 + 영업시간(open_time~close_time) 밖이면 gray** (SignalColor 정의와 일치).

### 생성/수정 파일

- `lib/signal.ts` (신규) — 순수 함수 `getSignal(restaurant, reports, now): { color, label, reason }`. PRD 3.2/3.3 규칙 구현. 시각은 `Intl.DateTimeFormat`로 `Asia/Seoul` 기준 변환(서버 TZ 무관).
- `lib/signal.test.ts` (신규) — Vitest. 3.3 표 12조합 + 경계(11:29/11:30, 12:14/12:15, 13:00/13:01) + 제보 90분 유효(strict `>`) + 최근 3건 최댓값 + gray 판정. **27개 전부 통과**.
- `lib/supabaseServer.ts` (신규) — 서버 컴포넌트용 anon key 읽기 클라이언트. service role 미참조.
- `app/page.tsx` (교체) — 플레이스홀더를 목록 화면으로 교체. 서버 컴포넌트에서 `restaurants` + 최근 90분 `wait_reports`를 anon으로 조회 후 `getSignal` 적용. 정렬(색 green→yellow→red→gray, 동일색 도보 오름차순), 필터 2종(URL 쿼리 `?solo=1`, `?nowait=1`, AND), 신호등 색+도형(●▲■○)+텍스트 라벨+`aria-label`, "N분 전 제보" 뱃지. `export const dynamic = "force-dynamic"`로 매 요청 갱신.

### 검증 결과

- `npm test` → **27/27 통과**
- `npm run typecheck` → 통과
- `npm run build` → 성공 (`/`는 동적 렌더 `ƒ`)
- `npm run dev` → `http://localhost:3000` **HTTP 200**, 9곳 전부 렌더·신호등 색·판정 이유·필터 링크 정상 확인

### 해석/결정 메모

- 필터 "혼밥 가능만"은 `solo_status !== 'red'`로 해석함(혼밥 차원 기준). "웨이팅 없는 곳만"은 최종 색 green만. PRD 5.1의 괄호 표기가 모호하여 이 해석을 채택.
- 현재 시각(오후)이 점심 기본값 시간대(11:30~13:00) 밖이고 제보도 없어, 화면상 모든 카드가 "웨이팅 정보 없음"으로 표시되며 색은 `solo_status`만으로 결정됨. 점심시간엔 `wait_1200/1230` 기본값이 반영되어 색이 달라짐. (정상 동작)
- 개발 중 `npm run build`가 실행 중이던 이전 `next dev`의 `.next`를 덮어써서 좀비 프로세스가 500을 반환한 적 있음. 포트 3000 리스너 종료 + `.next` 삭제 후 재기동으로 해결.

### 아직 구현하지 않음 (다음 단계)

- 상세 화면 `/r/[id]` 및 웨이팅 원탭 제보(PRD 5.2, 4단계)
- PWA 매니페스트/아이콘 및 배포(5단계)
- 로그인/리뷰/관리자 등 PRD 2장 범위 밖 기능

### 남은 차단 요소 / 유의사항

1. **데이터 신뢰도** — 시드된 9곳의 혼밥/웨이팅/도보/분위기 값은 데모용 임의값. 실서비스 전 실제 조사값으로 교체 필요.
2. **service_role 키 노출** — 채팅에 노출됨. Supabase에서 rotate 권장(미확인).
3. **현재 시각 표시** — 서버 렌더 시점의 KST 시각으로 고정 표시되며 실시간으로 tick 하지 않음. MVP 범위상 허용.

## 11. 4단계 (상세 화면 + 웨이팅 원탭 제보) — 같은 세션에서 완료

PRD 5.2 상세 화면과 제보 기능을 구현했다.

### 생성/수정 파일

- `app/TrafficLight.tsx` (신규) — 신호등 컴포넌트를 목록/상세 공용으로 추출. `size="sm"|"lg"` 지원, `CHIP`(라벨 색) export. (기존 `app/page.tsx` 안의 로컬 TrafficLight/CHIP은 제거하고 여기서 import)
- `lib/supabaseClient.ts` (신규) — 브라우저(클라이언트 컴포넌트)용 anon 클라이언트 싱글턴. 제보 INSERT용.
- `app/r/[id]/page.tsx` (신규) — 상세 서버 컴포넌트. `restaurants` 단건 + 최근 90분 `wait_reports` 조회 → `getSignal`. PRD 5.2 순서(큰 신호등+이유 → 제보 → 혼밥정보 → 분위기 → 기본정보 → 카카오맵). `force-dynamic`.
- `app/r/[id]/ReportButtons.tsx` (신규, `"use client"`) — "지금 웨이팅 어때요?" 3버튼(없음/5~10분/15분↑). 탭 시 anon으로 `wait_reports` INSERT → 토스트 "제보 감사합니다" → `router.refresh()`로 신호등 재계산. `device_id`는 localStorage UUID. **동일 기기 10분 내 재제보 방지**(localStorage 타임스탬프로 버튼 비활성화). 로그인·확인창 없음.
- `app/page.tsx` (수정) — 목록 카드를 `/r/[id]` 링크로 감쌈. TrafficLight/CHIP을 공용 컴포넌트에서 import.

### 검증

- `npm run typecheck` ✅ / `npm run build` ✅ (`/r/[id]` 동적 라우트 생성)
- dev: 목록 200, 상세 200, 카드→상세 링크 확인, 상세 전 섹션 렌더 확인
- anon `wait_reports` INSERT/SELECT(최근 90분) RLS 허용 확인 (테스트 제보 삽입→service role로 정리)

### 동작 메모

- 제보를 넣으면 `getSignal`의 웨이팅 우선순위(유효 제보 최우선)에 의해 **점심시간대가 아니어도** 신호등이 즉시 바뀐다(예: "15분 이상" 제보 → red). 90분 지나면 제보 만료되어 원상 복귀.
- 중복 방지는 **클라이언트(localStorage)만**. 서버 검증은 PRD대로 MVP 범위 밖.

### 남은 것 (5단계 등)

- PWA 매니페스트/아이콘 + Vercel 배포(5단계)
- 실데이터 반영(사용자 전화조사 CSV → `data/restaurants.csv` 변환·시드)
- service_role 키 rotate, git 커밋, data 폴더 옛 통화리스트 파일 정리

## 12. 신호등 보조 신호 추가 (속도 + 제보 신뢰도) — 같은 세션에서 완료

PRD §2 범위 밖이지만 사용자 요청으로 추가. **신호등 색 로직(3.3)은 그대로 두고**, 색 옆의 보조 정보/필터로만 붙임.

### 로직 (`lib/signal.ts`)

- `isQuickMeal(restaurant)` (신규 export) — "혼자 빨리 먹기 좋은가" 추정. 빠른 카테고리(국밥/국수/분식/면류/덮밥/샐러드 등) 정규식 매칭이면 +2, `order_type==='kiosk'` +1, `self_bar` +1 → score≥2면 true.
- `getWaitInfo(restaurant, reports, now): WaitInfo` (신규 export) — 웨이팅을 어떤 근거로 냈는지 + 신뢰도. `{ level, source: 'report'|'default'|'none', reportCount, freshestMin }`. 기존 `getSignal`은 이 함수를 재사용하도록 리팩터(색 판정 결과·동작은 불변, 테스트 그대로 통과).

### UI

- 목록(`app/page.tsx`): 필터 칩 `⚡ 빨리 먹기`(`?quick=1`, 기존 필터와 AND) 추가. 카드에 `⚡ 빨리` 칩, 그리고 신뢰도 배지("실시간 N분 전" / "평소 기준" / 없음) 표시.
- 상세(`app/r/[id]/page.tsx`): 제목 옆 `⚡ 빨리` 배지, 신호등 아래 신뢰도 문구("실시간 제보 기준 · N명 · 최근 M분 전" / "평소 점심시간 기준 (추정)" / "웨이팅 정보 없음").

### 검증

- 테스트 33개(+6) 통과, 타입검사·빌드 ✅
- dev: ⚡빨리 필터 동작(9곳→4곳), 배지·신뢰도 렌더 확인. 브라우저 실제 제보 6건으로 "실시간" 배지 동작 확인.
