// Серверная функция Vercel для формы обратной связи — токен только на сервере.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(500).json({ error: 'Server is not configured' });
    return;
  }

  const { name, contact, message: userMessage } = req.body || {};

  if (!name || !userMessage) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const esc = (s) => String(s).slice(0, 1000);

  const message =
    '📩 *Сообщение с сайта AVEREST*\n\n' +
    '👤 ' + esc(name) + '\n' +
    (contact ? '📞 ' + esc(contact) + '\n' : '') +
    '\n💬 ' + esc(userMessage);

  try {
    const tgRes = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });

    if (!tgRes.ok) {
      res.status(502).json({ error: 'Telegram API error' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Failed to reach Telegram' });
  }
}
