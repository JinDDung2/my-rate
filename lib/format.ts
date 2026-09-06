export function formatDisclosureMonth(disclosureMonth: string): string {
  if (!/^\d{6}$/.test(disclosureMonth)) return disclosureMonth;

  return `${disclosureMonth.slice(0, 4)}-${disclosureMonth.slice(4, 6)}`;
}

export function formatKrw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

export function formatRateBpPercentPoint(rateBp: number): string {
  return `${Number((rateBp / 100).toFixed(2))}%p`;
}
