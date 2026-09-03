# FSS 적금상품 데이터 수집

## Goal

금융감독원 "금융상품 한눈에"(finlife.fss.or.kr) 오픈API에서 적금상품 원본 데이터를
`data/raw/savings.json`으로 확보한다. (REALRATE 개발플랜 1단계 "데이터 확보")

## Log

- **09:58** `.env`에 `DART_API_KEY`만 있는 걸 확인. 이번 단계는 DART가 아니라 FSS
  오픈API를 쓰는 거라 별도 키(`FSS_API_KEY`)가 필요하다는 걸 짚고 넘어감.
- 프로젝트에 `package.json`이 아예 없어서 최소 스캐폴딩부터 구성:
  `typescript`, `tsx`, `dotenv`, `@types/node`.
- `scripts/fetch-products.ts` 작성 — 개발플랜 문서의 AI 프롬프트 스펙 그대로
  (`auth=FSS_API_KEY`, `topFinGrpNo=020000`, 페이지 순회 300ms 대기, 첫 페이지
  키 목록 콘솔 출력, 에러 시 원문 응답 그대로 출력).
- 1차 실행 → `baseList[0]`, `optionList[0]`가 빈 배열. 원인 확인을 위해 raw
  응답을 직접 curl 떠보니:
  ```json
  {"err_cd":"010","err_msg":"미등록 인증키"}
  ```
  발급받은 키가 서버에서 미등록 상태로 거부됨. FSS 키 발급처(finlife.fss.or.kr
  오픈API 메뉴)가 DART와 다르다는 걸 재확인시키고 재발급 요청.
- 사용자가 키 재등록 → 재실행 시 `err_cd: "000"` (정상), `total_count: 59`로
  응답 확인.
- 전체 스크립트 실행 → `data/raw/savings.json` 생성 완료
  (`baseList` 59건, `optionList` 181건).

## Verification

문서 상 필드명 가정(`spcl_cnd`, `intr_rate`, `intr_rate2`, `save_trm`,
`rsrv_type`, `intr_rate_type`)을 실제 응답 키 목록과 대조 — **전부 일치**함을
확인. 문서의 "공개 문서에서 재확인되지 않았다" 경고는 이제 해소됨.

DoD 체크:

| 조건 | 목표 | 실제 |
|---|---|---|
| 상품 수 | 30건 이상 | 59건 |
| `spcl_cnd` 비어있지 않은 상품 | 20건 이상 | 59건 (내용 있는 건 58건, "없음" 1건) |

## Decisions

- `max_page_no`가 1로 나와 사실상 단일 페이지에 전체 데이터가 들어옴. 다음 달
  이후 데이터가 늘어날 가능성을 대비해 페이지 순회 로직은 그대로 유지.
- 인증키는 서비스별로 분리 관리한다 (`DART_API_KEY`, `FSS_API_KEY`). 앞으로
  다른 오픈API를 추가할 때도 이 네이밍 규칙을 따른다.

## Next

`scripts/extract-conditions.ts` — `spcl_cnd` 원문을 구조화 JSON으로 추출하는
단계로 진행.
