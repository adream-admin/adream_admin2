export async function alertServerError(route: string, error: unknown): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const msg = error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);

  const text = [
    '🚨 <b>서버 오류 (스케줄 어드민)</b>',
    `📍 ${route}`,
    `💬 ${msg.slice(0, 300)}`,
    `⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* 알림 실패는 무시 */ }
}
