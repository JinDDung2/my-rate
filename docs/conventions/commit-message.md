# Commit Message Convention

이 저장소는 Conventional Commits 형식을 사용한다.

## Format

```text
<type>(<scope>): <subject>

<body>

<footer>
```

- `type`은 변경의 성격을 나타낸다.
- `scope`는 선택이며 변경한 영역을 짧게 적는다. 예: `api`, `ui`, `docs`, `deps`
- `subject`는 명령형 현재 시제로 50자 안팎을 권장한다.
- `body`는 왜 변경했는지, 어떤 의사결정이 있었는지 필요할 때만 적는다.
- `footer`에는 이슈 연결, breaking change, 참고 링크를 적는다.

## Types

- `feat`: 사용자 관점의 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 포맷팅, 세미콜론, 공백 등 동작 변화가 없는 변경
- `refactor`: 기능 변화 없는 구조 개선
- `perf`: 성능 개선
- `test`: 테스트 추가 또는 수정
- `build`: 빌드 시스템, 패키지, 의존성 변경
- `ci`: CI/CD 설정 변경
- `chore`: 기타 유지보수 작업
- `revert`: 이전 커밋 되돌리기

## Rules

- 제목은 `type(scope): subject` 형태로 작성한다.
- 제목 끝에 마침표를 붙이지 않는다.
- 한 커밋에는 하나의 논리적 변경만 담는다.
- 변경 이유가 코드만으로 분명하지 않으면 본문에 배경과 판단 근거를 적는다.
- 이슈를 닫는 커밋 또는 PR은 footer에 `Closes #123` 형식으로 연결한다.
- 호환성을 깨는 변경은 footer에 `BREAKING CHANGE: ...`를 반드시 적는다.
- 자동 생성 파일만 바뀐 커밋도 원인 변경과 분리하거나 본문에 생성 이유를 적는다.

## Examples

```text
feat(rate): add preferential condition calculator
```

```text
fix(api): handle missing bank rate payload

FSS 응답에서 일부 상품의 우대금리 항목이 누락되는 경우가 있어
기본값을 적용하고 수집 실패로 처리하지 않도록 수정한다.

Closes #42
```

```text
docs: add pull request template and commit convention
```

```text
refactor(parser): split FSS response normalizer
```

```text
feat(auth): replace session token format

BREAKING CHANGE: 기존 세션 토큰은 더 이상 인증에 사용할 수 없다.
```

## Local Commit Template

커밋 작성 화면에 템플릿을 띄우려면 아래 명령을 실행한다.

```sh
git config commit.template .gitmessage.txt
```
