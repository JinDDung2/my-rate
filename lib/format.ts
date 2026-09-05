export function formatDisclosureMonth(disclosureMonth: string): string {
  if (!/^\d{6}$/.test(disclosureMonth)) return disclosureMonth;

  return `${disclosureMonth.slice(0, 4)}-${disclosureMonth.slice(4, 6)}`;
}
