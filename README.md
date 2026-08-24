# 혼밥 신호등

## 로컬 셋업

1. 의존성을 설치합니다.

   ```bash
   npm install
   ```

2. `.env.local.example`을 복사해 `.env.local`을 만들고 Supabase 값을 입력합니다. `SUPABASE_SERVICE_ROLE_KEY`는 시드와 RLS 검사 스크립트에서만 사용합니다.

3. Supabase CLI 또는 SQL Editor로 `supabase/migrations/0001_init.sql`을 적용합니다.

4. `data/restaurants.csv`에 식당 데이터를 입력합니다. 쉼표가 포함된 값은 큰따옴표로 감싸고, `closed_days`는 `0;6` 형식으로 작성합니다.

5. 시드를 실행합니다.

   ```bash
   npx tsx scripts/seed.ts
   ```

6. RLS를 확인합니다.

   ```bash
   npx tsx scripts/check-rls.ts
   ```

7. 개발 서버를 실행합니다.

   ```bash
   npm run dev
   ```
