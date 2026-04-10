/**
 * 날짜 문자열을 UTC 자정(00:00:00Z)으로 파싱.
 * new Date("2024-01-15") 는 UTC 자정으로 파싱되지만,
 * 서버 로컬 타임존에 따라 동작이 다를 수 있으므로 명시적으로 Z를 붙인다.
 */
export function parseUTCDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z');
}

/**
 * 해당 날짜의 UTC 자정 ~ 다음날 UTC 자정 범위를 반환.
 * DB 쿼리의 gte/lt 필터에 사용.
 */
export function getDayRange(dateStr: string): { start: Date; end: Date } {
  const start = parseUTCDate(dateStr);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
