## Goal

단일 페이지 상단에 [A] 입력 패널을 만든다. 월 납입액(10,000~1,000,000원, 만원 단위), 가입 기간(6/12/24/36개월), 적립 방식(정액/자유), 표준 우대조건 8종 체크박스를 입력받고, **제출 버튼 없이** 입력이 바뀌는 즉시 하위 계산이 소비할 수 있는 단일 입력 상태(`CalcInput`)를 갱신한다. 범위·단위를 벗어난 월 납입액은 인라인 경고를 띄우되 계산에 쓰이는 값은 **직전 유효값**을 유지한다. `OTHER`는 체크 불가 정보 표시용으로만 렌더한다.

## Context

- **스펙 근거**: `REALRATE_기능명세서.md:97-100`(F-02), `:39-53`(§3 표준 우대조건 코드 8종 + `OTHER` 계산 제외), `:57-85`(§4 화면 구성 [A]), `:270-279`(§10 비기능 — 200ms 이내 갱신, 모바일 우선, WCAG AA, **금액 천 단위 구분**, 사용자 입력 서버 로깅 금지).
- **이슈 #1 결과 위에 쌓는다 (확인함)**. Next.js App Router + TS + Tailwind가 이미 스캐폴딩되어 있고, `app/page.tsx`가 `ProductList`를 직접 렌더한다. 클라이언트 데이터 로드는 `lib/use-products.ts`의 `useProducts()`가 `{ status, data, error, reload }`로 제공한다. **이 훅과 `/api/products` 계약을 바꾸지 않는다.**
- **도메인 타입 단일 출처는 `lib/types.ts`** (`ConditionCode`, `CONDITION_CODES`, `SpecialCondition`, `RateOption`, `Product`, `ProductsResponse`). `scripts/lib/types.ts`는 재export 셰임이다. 적립 방식은 이미 `RateOption['rsrvType'] = 'S' | 'F'`로 존재하므로 **새 유니온을 만들지 말고 재사용한다.**
- **이 이슈는 계산을 하지 않는다.** 내 금리(#3), 이자 엔진(#4), 랭킹(#5)이 아직 없다. 따라서 AC "즉시 결과가 갱신된다"를 이 이슈 안에서 증명하려면 **관측 가능한 임시 출력**이 필요하다(아래 설계 결정 4).
- **입력 상태는 #3·#5·#6·#7이 전부 읽고, #11이 URL로 직렬화한다.** 지금 정하는 상태 모양이 그 4개 이슈의 인터페이스가 된다. 직렬화 가능한 평면 객체로 고정할 것.
- **데이터 실측 (`data/products.json`, 43상품 / 135옵션)**:
  - `saveTrm` 분포: 1개월 8, 3개월 6, **6개월 23, 12개월 44, 24개월 28, 36개월 26**. 1·3개월 옵션이 데이터에 존재하지만 스펙상 선택 불가다 → 패널은 6/12/24/36만 노출하고, 나머지 옵션의 배제는 #5의 필터 책임이다.
  - `rsrvType` 분포: **자유적립(F) 104옵션, 정액적립(S) 31옵션**. `S` 옵션을 하나라도 가진 상품은 **43건 중 12건뿐**이다.
  - `conditions[].code` 분포: `OTHER`가 46건으로 최다. 나머지 8종은 5~14건. → `OTHER`를 계산에서 빼는 규칙이 실제로 큰 영향을 준다.
  - **리스크**: 스펙 §4 목업의 기본값이 `(•) 정액적립`인데, 그대로 두면 #5 랭킹 후보가 43건 중 12건으로 줄어든다. 이 이슈에서는 스펙대로 정액적립을 기본값으로 두되, **#5에서 빈/희소 결과 처리와 기본값 재검토가 필요하다**는 사실을 남긴다.
- **테스트 러너가 아직 없다.** `package.json`에 test 스크립트가 없고 #4에서 도입 예정이다. 따라서 이 이슈의 검증은 `typecheck` + `build` + 수동 확인이다. 대신 검증 로직을 순수 함수로 분리해 두면 #4가 러너를 붙이는 즉시 테스트 대상이 된다.

## Constraints

### 반드시 지킬 것

1. **입력 상태는 하나의 직렬화 가능한 객체로 관리한다.** `Set`·`Map`·클래스 인스턴스를 상태에 넣지 않는다(#11 URL 직렬화가 깨진다). 선택 조건은 `CONDITION_CODES` 순서를 따르는 **정렬된 배열**로 유지해 쿼리스트링이 결정적이도록 한다.
2. **"화면에 보이는 입력값(draft)"과 "계산에 쓰이는 값(committed)"을 분리한다.** 월 납입액은 `amountText: string`(사용자가 친 그대로)과 `CalcInput.monthlyAmount: number`(마지막 유효값)로 나눈다. 하위 계산은 **절대 `amountText`를 읽지 않는다.** 이것이 AC3의 전부다.
3. **`OTHER`는 타입 레벨에서 선택 불가로 만든다.** `type CheckableConditionCode = Exclude<ConditionCode, 'OTHER'>`를 정의하고 선택 상태 배열의 원소 타입으로 쓴다. 런타임 `disabled` 속성만으로 막지 않는다.
4. **체크박스 문구는 §3 표준 라벨을 쓴다.** `SpecialCondition.label`은 상품별 AI 해석 라벨이므로 패널 라벨로 쓰면 안 된다. §3 표(`REALRATE_기능명세서.md:41-51`)를 `lib/conditions.ts`의 상수 맵으로 옮기고 JSX에 문자열을 흩뿌리지 않는다.
5. **기간 선택지는 `[6, 12, 24, 36]` 상수 하나에서만 나온다.** 데이터의 `saveTrm`을 스캔해서 만들지 않는다(1·3개월이 섞여 들어온다).
6. **금액은 천 단위 구분해 표시한다**(§10). `type="number"`는 콤마를 렌더할 수 없으므로 `type="text" inputMode="numeric"`을 쓴다.
7. **새 런타임 의존성을 추가하지 않는다.** 폼 라이브러리·`zod`·상태 관리 라이브러리 전부 금지. `useState`로 충분하다.
8. **Tailwind `content` 글롭이 `./app/**`와 `./lib/**`만 커버한다**(`tailwind.config.ts:4`). 루트 `components/` 디렉터리를 새로 만들면 스타일이 통째로 날아간다. 새 컴포넌트는 `app/_components/` 아래에 둔다.
9. **`lib/types.ts`(§6 데이터 모델 미러)를 수정하지 않는다.** 입력 상태 타입은 도메인 모델이 아니므로 `lib/calc-input.ts`에 둔다.
10. **사용자 입력을 서버로 보내지 않는다**(§10 로깅 금지). 이 이슈는 네트워크 호출이 0건이어야 한다. `console.log`로 입력값을 남기지 않는다.
11. **기존 `useProducts`/`ProductList`/`/api/products` 동작을 바꾸지 않는다.** `app/page.tsx`의 조립만 바꾼다.

### 범위 밖 (하지 말 것)

- 내 금리 산정(#3), 이자 계산 엔진(#4), 랭킹 테이블(#5), 1위 상세 카드(#6), 액션 리스트(#7) — 임시 출력에 이자·금리 계산을 넣지 말 것.
- URL 쿼리스트링 직렬화·복원(#11). **상태 모양만 직렬화 가능하게 준비**하고 `useSearchParams`는 도입하지 않는다.
- 자연어 입력(#10). §4 목업의 `( 자연어로 입력하기 ▸ )` 슬롯은 이번에 렌더하지 않는다.
- 디자인 시스템·다크모드·애니메이션. 기존 slate 팔레트 유틸리티 클래스를 그대로 따른다.
- 데이터 재수집·`data/products.json` 수정. 읽기 전용이다.
- 테스트 러너 도입(#4 소관).

### 설계 결정 (가정 — 다르게 가려면 먼저 알릴 것)

1. **유효값 정의 = `10000 ≤ x ≤ 1000000` 그리고 `x % 10000 === 0`.** 범위 안이지만 만원 단위가 아닌 값(예: 15,000)도 무효로 보고 경고 + 직전 유효값 유지로 처리한다. 자동 스냅(반올림)은 사용자가 타이핑 중인 숫자를 덮어써서 입력을 방해하므로 채택하지 않는다. 경고 문구를 사유별로 구분한다: 범위 밖 → `10,000원 ~ 1,000,000원 사이로 입력해 주세요`, 단위 불일치 → `만원 단위로 입력해 주세요`.
   - *타이핑 중 경고 깜빡임 완화*: 입력창 옆에 **만원 단위 ± 스텝 버튼**을 둬서 경고가 뜨지 않는 주 조작 경로를 제공한다. 타이핑 경로에서 `5` → `50` → `500` 입력 중 경고가 잠깐 뜨는 것은 의도된 즉시 피드백으로 간주한다.
2. **입력 상태 소유자는 새 클라이언트 컴포넌트 `app/_components/calculator.tsx` 하나다.** Context를 도입하지 않는다. #5~#7이 붙어도 이 컴포넌트의 형제로 들어가므로 props 전달로 충분하고, Context는 리렌더 경계를 흐려 §10의 200ms 요건 추적을 어렵게 한다.
3. **`app/page.tsx`는 서버 셸을 유지**하고 `<ProductList />` 대신 `<Calculator />`를 렌더한다. `ProductList`는 `Calculator` 하위로 그대로 이동시킨다(#5에서 랭킹 테이블로 대체될 때까지 데이터 로드가 살아 있어야 한다).
4. **AC1을 증명하기 위한 임시 출력**을 `Calculator` 안에 둔다:
   - (필수) **커밋된 입력 요약** — `월 500,000원 · 12개월 · 정액적립 · 선택 조건 2개`. 이게 갱신되는 것이 AC1의 증거다.
   - (선택) **매칭 상품 건수** — `products.filter(p => p.options.some(o => o.saveTrm === termMonths && o.rsrvType === reserveType)).length`. 계산 없이 반응성을 보여준다. 넣는다면 `{/* 임시: 이슈 #5 랭킹 테이블로 대체 */}` 주석을 반드시 남긴다.
   - 이자·금리 값은 표시하지 않는다(#3·#4 침범).
5. **기본값**: `{ monthlyAmount: 500000, termMonths: 12, reserveType: 'S', selectedConditions: [] }`. 금액·기간·적립방식은 §4 목업을 그대로 따랐다. 목업에 체크되어 보이는 `비대면 가입`·`마케팅 동의`는 예시로 판단해 기본 선택하지 않는다.
6. **검증 로직은 UI와 분리된 순수 함수로 뺀다** (`lib/calc-input.ts`). #4가 테스트 러너를 도입하는 즉시 테스트 가능해야 한다.

### 알려진 함정

- **제어 입력 + 숫자 파싱**: 사용자가 전부 지운 빈 문자열은 "무효"지 "0"이 아니다. `Number('')`는 `0`이므로 `Number()`로 바로 파싱하면 빈 입력이 조용히 통과한다. 빈 문자열·공백·비숫자 문자를 파싱 전에 명시적으로 걸러낼 것.
- **콤마 처리**: 표시용 콤마를 다시 파싱 대상으로 넣지 말 것. 입력 처리 순서는 `사용자 입력 → 숫자 외 문자 제거 → 파싱/검증 → 표시용 콤마 포맷`이다. 커서 점프를 피하려면 포맷 결과를 매 키 입력마다 되돌려 쓰기보다, 원문을 유지하고 콤마 포맷은 **입력창 아래 보조 표기** 또는 blur 시점에만 적용하는 쪽이 안전하다. 어느 쪽을 택했는지 리포트에 남길 것.
- **React key/`htmlFor` 충돌**: 체크박스 8개의 `id`는 조건 코드에서 파생시킨다(`cond-SALARY_TRANSFER`). 인덱스 사용 금지.
- **`OTHER` 렌더**: `disabled` 체크박스는 키보드 포커스를 받지 못해 스크린리더가 건너뛴다. 정보 표시가 목적이므로 체크박스 대신 **`(계산 제외)` 배지가 붙은 안내 행**으로 렌더하는 편이 낫다. 어느 쪽이든 상태 배열에는 절대 들어가지 않아야 한다.
- **`'use client'` 누락**: `app/page.tsx`는 서버 컴포넌트로 남기고 `Calculator`·`ConditionPanel`에 `'use client'`를 붙인다. 훅(`lib/use-calc-input.ts`)에도 필요하다(`lib/use-products.ts:1` 선례 참고).
- **`npm run build`는 `check:reviewed`를 먼저 돌린다**(`package.json:13`). 이 게이트를 건드리지 말 것.
- **`.env`의 키는 이 이슈와 무관하다.** 클라이언트 번들에 어떤 환경변수도 들어가면 안 된다.

## Files To Inspect

**읽을 것**

- `REALRATE_기능명세서.md:39-53, 57-85, 97-100, 270-279` — §3 조건 코드표, §4 [A] 패널, F-02, §10 비기능
- `docs/github-issues/02-condition-input-panel.md` — 이슈 원문
- `docs/github-issues/03-my-rate-calculation.md`, `05-ranking-table.md`, `11-shareable-results-url.md` — 이 상태를 소비할 다음 이슈들. 인터페이스 결정 근거
- `lib/types.ts` — `ConditionCode`, `CONDITION_CODES`, `RateOption['rsrvType']` 재사용
- `lib/use-products.ts` — 클라이언트 훅 작성 스타일 선례 (`'use client'`, 배타 상태, `useCallback`)
- `app/_components/product-list.tsx` — Tailwind 클래스·마크업 컨벤션, `aria-labelledby` 사용 선례
- `app/page.tsx`, `app/layout.tsx`, `tailwind.config.ts`, `app/globals.css` — 조립 지점과 스타일 경계
- `lib/format.ts` — 포맷터가 모이는 자리
- `docs/records/handoffs/issue-1-plan.md`, `docs/records/2026-09-05-product-data-load-decisions.md` — 앞 이슈의 결정과 기록 형식
- `docs/agents/development.md` — 커밋은 요청이 있을 때만

**새로 만들 것 (제안)**

- `lib/conditions.ts` — `CONDITION_META: Record<ConditionCode, { label: string; checkboxLabel: string }>` (§3 표 그대로), `CHECKABLE_CONDITION_CODES` (= `CONDITION_CODES.filter(c => c !== 'OTHER')`). #6·#7이 재사용한다.
- `lib/calc-input.ts` — 순수 모듈. `CalcInput` 타입, `CheckableConditionCode`, `DEFAULT_CALC_INPUT`, `TERM_OPTIONS = [6, 12, 24, 36] as const`, `MONTHLY_AMOUNT_MIN/MAX/STEP`, `parseMonthlyAmount(text): { ok: true; value: number } | { ok: false; reason: 'empty' | 'not-a-number' | 'out-of-range' | 'not-a-step' }`, `toggleCondition(codes, code)`(정렬 유지).
- `lib/use-calc-input.ts` — `'use client'`. `{ input: CalcInput, amountText: string, amountError: string | null, setAmountText, setTermMonths, setReserveType, toggleCondition }`. draft/committed 분리를 여기에서만 처리한다.
- `app/_components/condition-panel.tsx` — `'use client'`. [A] 패널 UI (금액 + 스텝 버튼, 기간 라디오 4종, 적립 방식 라디오 2종, 조건 체크박스 8종 + `OTHER` 안내 행).
- `app/_components/calculator.tsx` — `'use client'`. 상태 소유자. `<ConditionPanel />` + 임시 입력 요약 + 기존 `<ProductList />` 조립.

**수정할 것**

- `app/page.tsx` — `<ProductList />` → `<Calculator />`
- `lib/format.ts` — `formatKrw(value: number): string` 추가 (천 단위 구분). 기존 `formatDisclosureMonth`는 건드리지 않는다.

## Acceptance Criteria

- [ ] 제출 버튼이 화면에 존재하지 않고, 월 납입액·기간·적립 방식·조건 체크 중 무엇을 바꿔도 화면의 입력 요약이 즉시 갱신된다.
- [ ] 월 납입액에 `9000`, `1000001`, `abc`, 빈 문자열 중 무엇을 넣어도 인라인 경고가 표시된다.
- [ ] 월 납입액에 `15000`(범위 내·만원 단위 아님)을 넣으면 `만원 단위` 경고가 표시된다.
- [ ] 위 무효 입력 상태에서 입력 요약(= 계산에 쓰이는 값)은 **직전 유효값을 그대로 유지**한다.
- [ ] 무효 입력 뒤 다시 유효값을 넣으면 경고가 사라지고 요약이 새 값으로 갱신된다.
- [ ] 기간 선택지가 정확히 `6 / 12 / 24 / 36`개월 4개이며, 다른 값을 고를 UI 경로가 없다.
- [ ] 적립 방식이 정액적립/자유적립 2개 라디오이고 `RateOption['rsrvType']`(`'S' | 'F'`)로 매핑된다.
- [ ] 체크 가능한 조건이 정확히 8종이고, 문구가 `REALRATE_기능명세서.md:43-50`의 "체크박스 문구" 열과 일치한다.
- [ ] `OTHER`는 체크할 수 없고, 선택 상태 배열에 어떤 조작으로도 들어가지 않는다. 타입 레벨에서 `Exclude<ConditionCode, 'OTHER'>`로 막혀 있다.
- [ ] 선택 조건 배열이 `CONDITION_CODES` 순서로 정렬되어 있어, 같은 조건 집합이면 체크 순서와 무관하게 동일한 배열이 나온다.
- [ ] 금액 표시에 천 단위 구분이 적용된다(§10).
- [ ] 각 입력에 `<label>`이 연결되고, 라디오/체크박스 그룹이 `fieldset` + `legend`로 묶이며, 경고에 `role="alert"`와 `aria-describedby` 연결이 있다.
- [ ] 390px 폭에서 패널이 가로 스크롤 없이 1열로 읽히고 터치 타깃이 충분하다.
- [ ] `npm run typecheck` 통과.
- [ ] `npm run build` 통과, 그 안에서 `check:reviewed`가 먼저 실행된다.
- [ ] 이 이슈로 추가된 런타임 의존성이 0개다(`package.json` dependencies 변화 없음).
- [ ] 입력 변경 시 네트워크 요청이 발생하지 않는다(DevTools Network에서 확인).

## Verification

Codex가 실행하고 결과를 기록할 것.

1. `npm run typecheck` — 통과 로그 첨부.
2. `npm run build` — `check:reviewed` 출력이 `next build`보다 먼저 나오는지 확인.
3. `npm run dev` 후 브라우저에서 **입력 변경 즉시 갱신**:
   - 기간 `12` → `36` 클릭 → 요약이 즉시 `36개월`로 바뀐다(제출 없음).
   - 적립 방식 `정액` → `자유` → 즉시 반영.
   - 조건 체크/해제 → 선택 개수 즉시 반영.
4. **유효성 수동 확인** (각 단계마다 요약값이 유지되는지 함께 볼 것):
   - `500000` 입력(유효) → 요약 `500,000원`.
   - `9000` → 범위 경고, 요약은 `500,000원` 유지.
   - `1000001` → 범위 경고, 요약 유지.
   - `15000` → 만원 단위 경고, 요약 유지.
   - `abc` / 전체 삭제 → 경고, 요약 유지.
   - `300000` → 경고 사라지고 요약 `300,000원`.
   - ± 스텝 버튼으로 `10,000`(하한)·`1,000,000`(상한)에서 더 감소/증가 시도 → 경계를 넘지 않는다.
5. **`OTHER` 확인**: DevTools Elements에서 `OTHER` 항목에 활성 체크박스 입력이 없음을 확인. 콘솔에서 강제로 체크 시도해도 요약의 선택 개수가 변하지 않는다.
6. **접근성/모바일**: DevTools 디바이스 모드 390px에서 패널 전체 확인(스크린샷 첨부). Tab만으로 금액 → 기간 → 적립 방식 → 체크박스 8종을 모두 도달·조작할 수 있는지 확인.
7. **네트워크**: DevTools Network를 열고 입력을 여러 번 바꿔도 새 요청이 없는지 확인(최초 `/api/products` 1회 제외).
8. 자동 테스트는 이 이슈 범위 밖(테스트 러너 미설치, #4에서 도입). `lib/calc-input.ts`가 React 의존 없는 순수 모듈로 남아 있는지만 확인한다.

리포트에 남길 것: 실행한 검증과 결과, 콤마 포맷을 입력창 안/밖 중 어디에 적용했는지, "설계 결정" 중 다르게 간 항목과 이유, `OTHER` 렌더를 disabled 체크박스/안내 행 중 무엇으로 했는지, 임시 출력에 매칭 상품 건수를 포함했는지.