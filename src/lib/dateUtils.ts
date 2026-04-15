/**
 * 날짜 문자열을 UTC 자정(00:00:00Z)으로 파싱.
 * DB 저장 및 Prisma 쿼리에 사용.
 */
export function parseUTCDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z');
}

/**
 * KST 기준 현재 날짜 문자열 (YYYY-MM-DD)
 * 서버가 UTC 환경이어도 한국 시간 기준으로 반환.
 */
export function todayKST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/**
 * KST 기준 내일 날짜 문자열 (YYYY-MM-DD)
 */
export function tomorrowKST(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
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
