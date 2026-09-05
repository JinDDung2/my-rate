export * from '../../lib/types.js';

import type { SpecialCondition } from '../../lib/types.js';

/** 추출 단계(Claude 호출)의 원시 출력 — 검증 전 상태. */
export interface RawExtraction {
  finCoNo: string;
  finPrdtCd: string;
  conditions: SpecialCondition[];
  /** JSON 파싱 실패 등으로 추출 자체가 실패한 경우 */
  failed?: boolean;
  failureReason?: string;
}
