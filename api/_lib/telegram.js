// Обёртка над Telegram Bot API для админ-бота.

const API = 'https://api.telegram.org/bot' + process.env.ADMIN_BOT_TOKEN;

async function call(method, payload) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description || res.status}`);
  }
  return data.result;
}

export function sendMessage(chatId, text, extra = {}) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

export function sendPhoto(chatId, photoUrl, caption, extra = {}) {
  return call('sendPhoto', { chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML', ...extra });
}

export function answerCallbackQuery(id, text) {
  return call('answerCallbackQuery', { callback_query_id: id, text });
}

export function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  return call('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

export async function getFileUrl(fileId) {
  const file = await call('getFile', { file_id: fileId });
  return `https://api.telegram.org/file/bot${process.env.ADMIN_BOT_TOKEN}/${file.file_path}`;
}

export async function downloadFile(fileId) {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}
