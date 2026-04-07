export interface ChartPoint {
  label: string;
  value: number;
}

function monthLabel(date: Date, language: string | undefined) {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : language === 'ky' ? 'ky-KG' : 'ru-RU', {
    month: 'short',
  }).format(date);
}

export function buildMonthSeries<T>(
  items: T[],
  language: string | undefined,
  options: {
    months?: number;
    getDate: (item: T) => string | Date | undefined | null;
    getValue?: (item: T) => number;
  }
): ChartPoint[] {
  const months = options.months || 6;
  const now = new Date();
  const buckets = Array.from({ length: months }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: monthLabel(date, language),
      value: 0,
    };
  });

  items.forEach((item) => {
    const rawDate = options.getDate(item);
    if (!rawDate) return;
    const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;

    const bucketKey = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = buckets.find((entry) => entry.key === bucketKey);
    if (!bucket) return;
    bucket.value += options.getValue ? options.getValue(item) : 1;
  });

  return buckets.map(({ label, value }) => ({ label, value: Math.round(value) }));
}

export function countByStatus<T>(
  items: T[],
  getStatus: (item: T) => string | undefined | null
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const status = getStatus(item) || 'UNKNOWN';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

export function sortByNewest<T>(items: T[], getDate: (item: T) => string | Date | undefined | null): T[] {
  return [...items].sort((left, right) => {
    const leftDate = getDate(left);
    const rightDate = getDate(right);
    const leftTime = leftDate ? new Date(leftDate).getTime() : 0;
    const rightTime = rightDate ? new Date(rightDate).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function relativeDaysFromNow(value: string | Date | undefined | null): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
