// Серверная функция Vercel — держит токен бота в секрете.
// Клиент шлёт сюда данные заказа, а не напрямую в Telegram API.

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

  const { itemName, itemPrice, name, phone, email, delivery, address, comment } = req.body || {};

  if (!itemName || !name || !phone) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const esc = (s) => String(s).slice(0, 500);

  const message =
    '🛍 *Новый заказ с сайта!*\n\n' +
    '*Товар:* ' + esc(itemName) + '\n' +
    '*Цена:* ' + esc(itemPrice) + '\n\n' +
    '*Покупатель:*\n' +
    '👤 ' + esc(name) + '\n' +
    '📞 ' + esc(phone) + '\n' +
    (email ? '📧 ' + esc(email) + '\n' : '') +
    '\n*Доставка:* ' + esc(delivery) + '\n' +
    (address ? '📍 ' + esc(address) + '\n' : '') +
    (comment ? '\n💬 ' + esc(comment) : '');

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
