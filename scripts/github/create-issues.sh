#!/usr/bin/env bash
set -euo pipefail

repo="${1:-JinDDung2/my-rate}"
issue_dir="docs/github-issues"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

ensure_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  gh label create "$name" \
    --repo "$repo" \
    --color "$color" \
    --description "$description" >/dev/null 2>&1 \
    || gh label edit "$name" \
      --repo "$repo" \
      --color "$color" \
      --description "$description" >/dev/null
}

ensure_label "feature" "0E8A16" "User-facing product functionality"
ensure_label "frontend" "1D76DB" "UI and client-side behavior"
ensure_label "backend" "5319E7" "Server routes and API behavior"
ensure_label "data" "FBCA04" "Product data and data processing"
ensure_label "calculation" "D93F0B" "Interest, ranking, and financial formulas"
ensure_label "ai" "A371F7" "AI extraction or LLM behavior"
ensure_label "quality" "BFDADC" "Testing, accessibility, performance, or release readiness"

create_issue() {
  local title="$1"
  local file="$2"
  shift 2

  gh issue create \
    --repo "$repo" \
    --title "$title" \
    --body-file "$issue_dir/$file" \
    "$@"
}

create_issue "[Feature] 상품 데이터 로드 및 /api/products 구현" "01-product-data-load.md" --label "feature,data,backend"
create_issue "[Feature] 조건 입력 패널 구현" "02-condition-input-panel.md" --label "feature,frontend"
create_issue "[Feature] 내 금리 산정 로직 구현" "03-my-rate-calculation.md" --label "feature,calculation"
create_issue "[Feature] 이자 계산 엔진 구현" "04-interest-engine.md" --label "feature,calculation"
create_issue "[Feature] 실수령 기준 랭킹 테이블 구현" "05-ranking-table.md" --label "feature,frontend,calculation"
create_issue "[Feature] 1위 상품 상세 및 광고 1위 대비 배지 구현" "06-top-product-detail.md" --label "feature,frontend"
create_issue "[Feature] 조건 충족 시뮬레이션 액션 리스트 구현" "07-action-list-simulation.md" --label "feature,frontend,calculation"
create_issue "[Feature] 근거 원문 및 미해석 우대폭 고지 구현" "08-evidence-and-unexplained-rate.md" --label "feature,frontend,data"
create_issue "[Feature] 우대조건 AI 추출 파이프라인 구현" "09-ai-extraction-pipeline.md" --label "feature,ai,data"
create_issue "[Feature] 결과 공유 URL 구현" "11-shareable-results-url.md" --label "feature,frontend"
create_issue "[Task] 고지, 접근성, 성능, 보안 요구사항 반영" "12-disclaimer-accessibility-performance.md" --label "quality,frontend"
create_issue "[Task] 대회 제출용 E2E 데모 준비" "13-end-to-end-demo-readiness.md" --label "quality"
