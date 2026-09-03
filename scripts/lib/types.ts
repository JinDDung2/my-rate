// 스펙 참조: REALRATE_기능명세서.md §6 데이터 모델

export type ConditionCode =
  | 'SALARY_TRANSFER'
  | 'CARD_USAGE'
  | 'AUTO_TRANSFER'
  | 'FIRST_CUSTOMER'
  | 'MARKETING_AGREE'
  | 'NON_FACE_TO_FACE'
  | 'LINKED_PRODUCT'
  | 'APP_MISSION'
  | 'OTHER';

export const CONDITION_CODES: ConditionCode[] = [
  'SALARY_TRANSFER',
  'CARD_USAGE',
  'AUTO_TRANSFER',
  'FIRST_CUSTOMER',
  'MARKETING_AGREE',
  'NON_FACE_TO_FACE',
  'LINKED_PRODUCT',
  'APP_MISSION',
  'OTHER',
];

export interface SpecialCondition {
  code: ConditionCode;
  label: string; // 사용자에게 보일 짧은 설명
  rateBp: number; // 우대폭 (basis point, 50 = 0.5%p). 불명 시 0
  evidence: string; // 공시 원문에서 그대로 잘라낸 근거 문장
  confidence: 'high' | 'low';
}

export interface RateOption {
  saveTrm: number; // 개월
  intrRateType: 'S' | 'M'; // S=단리, M=월복리
  rsrvType: 'S' | 'F'; // S=정액적립, F=자유적립
  baseRate: number; // % (intr_rate)
  maxRate: number; // % (intr_rate2)
}

export interface Product {
  finPrdtCd: string;
  companyName: string; // kor_co_nm
  productName: string; // fin_prdt_nm
  joinWay: string; // join_way
  rawSpecialCondition: string; // spcl_cnd 원문 (반드시 보존)
  conditions: SpecialCondition[];
  options: RateOption[];
  disclosureMonth: string; // dcls_month
  unexplainedBp: number; // 미해석 우대폭
  reviewed: boolean; // 사람 검수 완료 여부
}

/** 추출 단계(Claude 호출)의 원시 출력 — 검증 전 상태. */
export interface RawExtraction {
  finCoNo: string;
  finPrdtCd: string;
  conditions: SpecialCondition[];
  /** JSON 파싱 실패 등으로 추출 자체가 실패한 경우 */
  failed?: boolean;
  failureReason?: string;
}
