## Goal

`data/products.json`을 단일 소스로 `GET /api/products`가 `{ disclosureMonth, products }`를 반환하고, 첫 화면이 진입 시 이를 불러와 상품 목록과 데이터 기준월을 표시하며, 로드 실패 시 "데이터를 불러오지 못했습니다" 문구와 **동작하는** 재시도 버튼을 노출한다.

## Context

- **스펙 근거**: `REALRATE_기능명세서.md:91-95`(F-01), `:153-189`(§6 데이터 모델), `:259-266`(§9 API 명세). 런타임 아키텍처는 `REALRATE_기획서.md:113-129` — **런타임 LLM 호출 없음, DB 없음, `/api/products`는 정적 JSON 서빙**. 스택은 Next.js(App Router) + TypeScript + Tailwind, Vercel 배포로 명시되어 있다.
- **이 저장소에는 아직 웹 앱이 없다 (확인함).** `app/`, `src/`, `lib/`, `pages/`, `public/`, `next.config.*`가 전부 부재하고 `package.json`에 `next`/`react`/`react-dom`/`tailwindcss`가 없다. 현재 존재하는 것은 `tsx`로 도는 데이터 파이프라인(`scripts/*`)과 에이전트 오케스트레이터(`agents/*`)뿐이다. → **이슈 #1은 Next.js 스캐폴딩을 포함한다.** 이슈 #2~#13이 전부 이 위에 쌓이므로 여기서 잡은 구조가 프로젝트 기반이 된다.
- **데이터는 이미 목표 형태로 커밋되어 있다 (확인함).** `data/products.json` 최상위 키가 정확히 `disclosureMonth`, `products`. `disclosureMonth = "202608"`, 상품 **43건 / 14개 은행**, 전건 `reviewed: true`, `rawSpecialCondition` 원문 보존, `unexplainedBp > 0`인 상품 8건. → 응답 봉투를 새로 만들 필요 없이 파일을 그대로 서빙하면 AC 2·3이 충족된다.
- **도메인 타입도 이미 스펙과 1:1로 존재한다.** `scripts/lib/types.ts:3-53`에 `ConditionCode`, `CONDITION_CODES`, `SpecialCondition`, `RateOption`, `Product`가 정의되어 있고 `REALRATE_기능명세서.md:155-189`와 필드 단위로 일치한다. **새로 정의하지 말고 재사용한다.**
- `npm run build`는 현재 `check:reviewed`의 별칭이다(`package.json:12`). 이는 §8.2 규칙 5(전 상품 검수 전 배포 빌드 실패)를 강제하는 게이트다.
- 스펙 §9가 계산 모듈을 `lib/interest.ts`로 지목하므로, 공용 모듈의 정식 위치는 저장소 루트 `lib/`이다.

## Constraints

### 반드시 지킬 것

1. **도메인 타입 중복 정의 금지.** 단일 출처를 `lib/types.ts`로 옮기고 `scripts/lib/types.ts`는 `export * from '../../lib/types.js'` 재export 셰임으로 남긴다. 현재 4개 스크립트가 `./lib/types.js`를 import 중이므로(`check-reviewed`, `mark-reviewed`, `build-products`, `extract-conditions`) 이 방식이 import 경로를 건드리지 않는 최소 변경이다. `RawExtraction`은 파이프라인 전용이므로 `scripts/lib/types.ts`에 남긴다.
2. **`npm run build`에서 `check:reviewed` 게이트를 제거하지 않는다.** `"build": "npm run check:reviewed && next build"`로 체인한다.
3. **`npm run typecheck`(= `tsc --noEmit`)를 신설한다.** AC "타입 체크 통과"를 검증할 수단이 현재 없다.
4. **`rawSpecialCondition`은 응답에서 어떤 가공도 하지 않는다.** 절삭·정규화 금지(§6 "반드시 보존").
5. **런타임 LLM 호출·DB·외부 네트워크 호출을 도입하지 않는다.** 이 이슈는 어떤 API 키도 필요로 하지 않으며, `.env` 값이 클라이언트 번들에 들어가면 안 된다.
6. 기존 `scripts/`, `agents/` 동작을 바꾸지 않는다. `data/products.json`은 **읽기 전용**이다.

### 범위 밖 (하지 말 것)

- 조건 입력 UI(F-02), 내 금리 산정(F-03), 이자 엔진(F-04), 랭킹(F-05), 시뮬레이션(F-07) — 이슈 #2~#7 소관.
- `/api/parse-situation`(F-10) — 이슈 #10 소관.
- 데이터 재수집·재추출. `data/products.json`은 검수 완료 상태다.
- 디자인 시스템·테마 구축. 이 이슈의 UI는 "로드가 되는 것을 증명하는 최소 목록"이면 충분하다.
- 테스트 러너 도입. 계산 로직이 들어오는 이슈 #4에서 도입할 것을 권고한다.

### 설계 결정 (가정 — 다르게 가려면 먼저 알릴 것)

- **로딩은 클라이언트 fetch로 한다.** AC 4·5(재시도 버튼)가 상호작용을 요구하므로 서버 컴포넌트 직접 로드로는 충족할 수 없고, 그 경우 `/api/products`가 사용되지 않은 채 남는다. → `app/page.tsx`는 서버 셸, 내부에 클라이언트 컴포넌트를 두고 `useProducts()` 훅이 `loading | success | error` 배타 상태와 `reload()`를 제공한다.
- **React Query / SWR을 도입하지 않는다.** 의존성 없이 `useState` + `useEffect`로 충분하며, 이것이 앱의 유일한 원격 호출이다.
- **라우트 핸들러는 `data/products.json`을 정적 import 한다**(`resolveJsonModule` 이미 활성화). `fs.readFile(process.cwd() + ...)`는 Vercel 파일 트레이싱이 `app/` 밖 경로를 놓칠 수 있어 배포에서만 깨질 위험이 있다. 정적 import는 번들에 포함되어 결정적이고 "정적 JSON 서빙" 의도와 맞는다. JSON의 추론 타입은 넓으므로 `ProductsResponse`로 좁히는 지점을 `lib/products.ts` 한 곳에 모은다.
- **실패 상태를 수동 검증할 수 있어야 한다.** 정적 import 라우트는 사실상 실패하지 않으므로 **개발 환경 전용** 강제 실패 스위치를 둔다: `process.env.NODE_ENV !== 'production'`일 때만 `?forceError=1`에 500 + `{ error }` 반환. 프로덕션에서 이 분기는 도달 불가여야 한다.
- **UI 최소 범위**: 헤더에 `데이터 기준: 2026-08`(= `"202608"` 포맷팅), 각 행에 은행명·상품명·기간별 `baseRate ~ maxRate`. 정렬·필터 없음.

### 알려진 함정

- **`package.json`에 `"type": "module"`이 있다.** `next.config.js`가 ESM으로 해석되므로 `next.config.ts` 또는 `next.config.mjs`를 쓴다.
- **`tsconfig.json`이 현재 React/TSX를 컴파일할 수 없다.** `include`가 `["scripts/**/*.ts", "agents/**/*.ts"]`로 앱을 제외하고, `jsx` 옵션이 없고, `lib`에 `dom`이 없고, `types: ["node"]`로 고정되어 있다. `jsx: "preserve"`, `lib: ["dom","dom.iterable","esnext"]`, `noEmit`, `incremental`, `plugins: [{ "name": "next" }]`, `paths: { "@/*": ["./*"] }`를 추가하고 `include`를 넓힌다. `moduleResolution: "Bundler"`, `strict: true`는 이미 맞으므로 유지한다. `next dev` 최초 실행이 tsconfig를 자동 수정하므로 실행 후 diff로 위 항목 보존을 확인한다.
- **`.gitignore`에 `.next`/`out`은 이미 있다.** 중복 추가하지 말고 `next-env.d.ts`만 판단한다(Next 관례상 커밋 권장).
- `finPrdtCd`는 43건 전부 유일함을 확인했으므로 React key로 단독 사용해도 된다. 다만 `Product`에 `finCoNo`가 없어 은행 간 충돌 방어막이 없다 — 데이터 갱신 시 깨질 수 있으니 `` `${companyName}-${finPrdtCd}` `` 를 권장한다. **이 이슈에서 데이터 모델은 바꾸지 않는다.**
- `.env`의 키가 `FSS_API_KEY =...`처럼 `=` 앞 공백을 포함한다. 이 이슈와 무관하지만 인지해 둔다.

## Files To Inspect

**읽을 것**

- `REALRATE_기능명세서.md:91-95, 153-189, 259-266` — F-01, §6 데이터 모델, §9 API 명세
- `REALRATE_기획서.md:113-129` — §7 시스템 아키텍처와 스택 선정
- `docs/github-issues/01-product-data-load.md` — 이슈 원문
- `scripts/lib/types.ts` — 재사용할 도메인 타입
- `data/products.json` — 최상위 2개 키 + 상품 1건만 보면 충분(72KB)
- `package.json`, `tsconfig.json` — 스캐폴딩 시 수정 대상
- `scripts/check-reviewed.ts` — 건드리지 말 것. build 체인에서 보존해야 하는 게이트
- `docs/agents/development.md` — 개발 규칙(커밋은 요청 시에만)

**새로 만들 것(제안)**

- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `app/api/products/route.ts` — `GET` 핸들러
- `lib/types.ts` — 도메인 타입 단일 출처 (+ `ProductsResponse` 추가)
- `lib/products.ts` — JSON import + 응답 타입 좁히기 + `formatDisclosureMonth('202608') → '2026-08'`
- `lib/use-products.ts` — 클라이언트 훅 `{ status, data, error, reload }`
- `app/_components/product-list.tsx` — 로딩/에러/성공 렌더
- `next.config.ts`, `postcss.config.mjs`, Tailwind 설정

**수정할 것**

- `package.json` — `next`/`react`/`react-dom`/`tailwindcss`/`@types/react*` 추가, `dev`/`start`/`typecheck` 추가, `build`를 `check:reviewed && next build`로
- `tsconfig.json` — 위 "알려진 함정"대로
- `scripts/lib/types.ts` — `lib/types.ts` 재export 셰임으로 축소

## Acceptance Criteria

- [ ] `GET /api/products`가 200과 `{ disclosureMonth: string, products: Product[] }`를 반환한다. `disclosureMonth === "202608"`, `products.length === 43`.
- [ ] 응답의 각 상품 `rawSpecialCondition`이 `data/products.json`의 값과 문자열 동등하다(가공·절삭 없음).
- [ ] 첫 화면 진입 시 자동으로 로드가 시작되고, 성공 시 상품 목록과 `데이터 기준: 2026-08`이 보인다.
- [ ] 로드 실패 시 정확히 `데이터를 불러오지 못했습니다` 문구와 재시도 버튼이 렌더된다.
- [ ] 재시도 버튼 클릭이 실제 재요청을 발생시키고, 복구되면 목록이 정상 렌더된다.
- [ ] 로딩 중에는 에러 문구가 노출되지 않는다(상태가 배타적).
- [ ] `npm run typecheck`가 통과한다(`strict: true` 유지).
- [ ] `npm run build`가 통과하고, 그 안에서 `check:reviewed`가 여전히 먼저 실행된다.
- [ ] 도메인 타입이 `lib/types.ts` 한 곳에만 정의되고 `scripts/*`가 여전히 컴파일된다.
- [ ] `forceError` 분기가 `NODE_ENV === 'production'`에서 도달 불가하다.

## Verification

Codex가 실행하고 결과를 기록할 것:

1. `npm run typecheck` — 통과 로그 첨부
2. `npm run build` — `check:reviewed` 출력이 `next build`보다 먼저 나오는지 확인
3. `npm run dev` 후:
   - `curl -s localhost:3000/api/products | jq '{disclosureMonth, n: (.products|length)}'` → `{"disclosureMonth":"202608","n":43}`
   - `diff <(curl -s localhost:3000/api/products | jq -r '.products[0].rawSpecialCondition') <(jq -r '.products[0].rawSpecialCondition' data/products.json)` → 차이 없음
   - `curl -s -o /dev/null -w '%{http_code}' 'localhost:3000/api/products?forceError=1'` → `500`
4. 브라우저 `localhost:3000`:
   - 정상 로드: 목록 + `데이터 기준: 2026-08`
   - 실패 상태: DevTools Network Offline 후 새로고침 → `데이터를 불러오지 못했습니다` + 재시도 버튼
   - 재시도: Offline 해제 후 버튼 클릭 → 목록 렌더
5. 자동 테스트는 이 이슈 범위 밖(테스트 러너 미설치). 이슈 #4에서 도입 권고.

리포트에 남길 것: 실행한 검증과 결과, `next dev`가 `tsconfig.json`을 자동 수정했다면 그 diff, "설계 결정" 중 다르게 간 항목과 이유.