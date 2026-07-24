export function formatCurrency(amount: number, currency: string = 'KWD'): string {
  const formatter = new Intl.NumberFormat('ar-KW', {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

  return formatter.format(amount);
}
