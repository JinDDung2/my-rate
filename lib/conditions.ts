import type { ConditionCode } from '@/lib/types';
import { CONDITION_CODES } from '@/lib/types';

type CheckableConditionMeta = {
  label: string;
  checkboxLabel: string;
};

type InformationalConditionMeta = {
  label: string;
};

export const CONDITION_META: {
  [Code in Exclude<ConditionCode, 'OTHER'>]: CheckableConditionMeta;
} & { OTHER: InformationalConditionMeta } = {
  SALARY_TRANSFER: {
    label: '급여이체',
    checkboxLabel: '이 은행으로 급여를 받고 있어요',
  },
  CARD_USAGE: {
    label: '카드 실적',
    checkboxLabel: '이 은행 카드를 월 30만원 이상 써요',
  },
  AUTO_TRANSFER: {
    label: '자동이체',
    checkboxLabel: '공과금·통신비 자동이체를 걸 수 있어요',
  },
  FIRST_CUSTOMER: {
    label: '첫 거래',
    checkboxLabel: '이 은행과 첫 거래예요',
  },
  MARKETING_AGREE: {
    label: '마케팅 동의',
    checkboxLabel: '마케팅 정보 수신에 동의할 수 있어요',
  },
  NON_FACE_TO_FACE: {
    label: '비대면 가입',
    checkboxLabel: '앱·인터넷으로 가입할 거예요',
  },
  LINKED_PRODUCT: {
    label: '연계상품 보유',
    checkboxLabel: '청약·펀드·연금 등 다른 상품이 있어요',
  },
  APP_MISSION: {
    label: '앱 미션/출석',
    checkboxLabel: '앱 출석·미션 같은 이벤트를 수행할 수 있어요',
  },
  OTHER: {
    label: '기타(계산 제외)',
  },
};

export const CHECKABLE_CONDITION_CODES = CONDITION_CODES.filter(
  (code): code is Exclude<ConditionCode, 'OTHER'> => code !== 'OTHER',
);
