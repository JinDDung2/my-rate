import { formatDisclosureMonth } from '@/lib/format';
import { productsResponse } from '@/lib/products';

export function SiteDisclaimer() {
  const disclosureMonth = formatDisclosureMonth(productsResponse.disclosureMonth);

  return (
    <footer
      className="border-t border-slate-200 bg-white"
      role="contentinfo"
    >
      <div className="mx-auto grid max-w-5xl gap-2 px-5 py-5 text-sm leading-6 text-slate-700 sm:px-8">
        <p className="font-semibold text-slate-950">
          금융자문이 아니며, 적금 상품 비교를 위한 정보 제공 목적의 서비스입니다.
        </p>
        <p>
          데이터 출처: 금융감독원 금융상품통합비교공시, 기준월: {disclosureMonth}
        </p>
        <p>
          이자는 월 단위 근사 계산으로 산출하므로 실제 지급액과 다를 수 있습니다.
        </p>
        <p>
          자유적립식 상품도 MVP 계산에서는 매월 동일액을 납입한다고 가정합니다.
        </p>
      </div>
    </footer>
  );
}
