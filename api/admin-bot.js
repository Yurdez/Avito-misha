// Vercel serverless webhook — приём новых товаров от владельца через Telegram.

import { randomUUID } from 'node:crypto';
import {
  getDraft, saveDraft, clearDraft,
  addDraftPhoto, removeLastDraftPhoto, getDraftPhotos,
  addProduct, getProducts, setProductStatus, uploadPhoto,
} from './_lib/store.js';
import { sendMessage, sendPhoto, answerCallbackQuery, editMessageReplyMarkup, downloadFile, escapeHtml } from './_lib/telegram.js';
import { CATEGORIES, STATUS, isHttpsUrl, formatPrice as formatPriceRub } from './_lib/render.js';

const MAX_PHOTOS = 5;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const categoryKeyboard = {
  inline_keyboard: CATEGORY_KEYS.reduce((rows, key, i) => {
    const btn = { text: CATEGORIES[key], callback_data: 'cat:' + key };
    if (i % 2 === 0) rows.push([btn]); else rows[rows.length - 1].push(btn);
    return rows;
  }, []),
};

const statusKeyboard = (id) => ({
  inline_keyboard: [[
    { text: `${STATUS.available.emoji} В наличии`, callback_data: `status:${id}:available` },
    { text: `${STATUS.reserved.emoji} Забронировано`, callback_data: `status:${id}:reserved` },
    { text: `${STATUS.sold.emoji} Продано`, callback_data: `status:${id}:sold` },
  ]],
});

const conditionKeyboard = {
  inline_keyboard: [[
    { text: 'Хорошее', callback_data: 'cond:Хорошее' },
    { text: 'Отличное', callback_data: 'cond:Отличное' },
  ]],
};

const photosKeyboard = {
  inline_keyboard: [[{ text: '✅ Готово', callback_data: 'photos_done' }]],
};

const confirmKeyboard = {
  inline_keyboard: [[
    { text: '✅ Опубликовать', callback_data: 'publish' },
    { text: '❌ Отменить', callback_data: 'cancel' },
  ]],
};

function newDraft() {
  return { step: 'category' };
}

// Принимает "1800", "1 800", "999.99", "999,50" — но не даёт точке/запятой
// молча слиться с цифрами (иначе "999.99" превращалось бы в 99999).
function parsePrice(text) {
  const cleaned = text.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const price = Math.round(parseFloat(cleaned));
  return price > 0 ? price : null;
}

async function askCategory(chatId) {
  await sendMessage(chatId, 'Добавляем новую вещь.\n\nВыбери категорию:', { reply_markup: categoryKeyboard });
}

async function askNext(chatId, draft) {
  switch (draft.step) {
    case 'brand':
      return sendMessage(chatId, 'Бренд (например: Nike, Zara) — или «-», если без бренда:');
    case 'name':
      return sendMessage(chatId, 'Название товара (например: «Демисезонная куртка»):');
    case 'price':
      return sendMessage(chatId, 'Цена в рублях (только число, например 1800):');
    case 'size':
      return sendMessage(chatId, 'Размер (например: M, 32/32, 42):');
    case 'color':
      return sendMessage(chatId, 'Цвет:');
    case 'material':
      return sendMessage(chatId, 'Материал (например: хлопок, деним) — или «-», если не важно:');
    case 'condition':
      return sendMessage(chatId, 'Состояние:', { reply_markup: conditionKeyboard });
    case 'avitoUrl':
      return sendMessage(chatId, 'Ссылка на объявление на Авито — или «-», если пока нет:');
    case 'description':
      return sendMessage(chatId, 'Короткое описание/дефекты (или отправь «-», если нечего добавить):');
    case 'photos':
      return sendMessage(chatId, `Пришли фото товара (от 1 до ${MAX_PHOTOS} штук, можно по одному). Когда закончишь — нажми «Готово».`, { reply_markup: photosKeyboard });
    default:
      return null;
  }
}

async function sendConfirmation(chatId, draft, photos) {
  const caption =
    `<b>${draft.brand ? escapeHtml(draft.brand) + ' ' : ''}${escapeHtml(draft.name)}</b>\n` +
    `Категория: ${escapeHtml(CATEGORIES[draft.category])}\n` +
    `Размер: ${escapeHtml(draft.size)}\n` +
    `Цвет: ${escapeHtml(draft.color)}\n` +
    (draft.material ? `Материал: ${escapeHtml(draft.material)}\n` : '') +
    `Состояние: ${escapeHtml(draft.condition)}\n` +
    `Цена: ${formatPriceRub(draft.price)}\n` +
    (draft.avitoUrl ? `Авито: ${escapeHtml(draft.avitoUrl)}\n` : '') +
    (draft.description && draft.description !== '-' ? `\n${escapeHtml(draft.description)}\n` : '\n') +
    `\nФото: ${photos.length} шт.\n\nОпубликовать?`;

  await sendPhoto(chatId, photos[0], caption, { reply_markup: confirmKeyboard });
}

async function handleText(chatId, draft, text) {
  const trimmed = text.trim();

  if (trimmed === '/cancel') {
    await clearDraft(chatId);
    await sendMessage(chatId, 'Черновик отменён.');
    return;
  }

  switch (draft.step) {
    case 'brand':
      draft.brand = trimmed === '-' ? '' : trimmed.slice(0, 100);
      draft.step = 'name';
      break;
    case 'name':
      if (!trimmed) { await sendMessage(chatId, 'Название не может быть пустым.'); return; }
      draft.name = trimmed.slice(0, MAX_NAME_LENGTH);
      draft.step = 'price';
      break;
    case 'price': {
      const price = parsePrice(trimmed);
      if (!price) {
        await sendMessage(chatId, 'Не понял цену. Пришли целое число рублей, например 1800.');
        return;
      }
      draft.price = price;
      draft.step = 'size';
      break;
    }
    case 'size':
      draft.size = trimmed;
      draft.step = 'color';
      break;
    case 'color':
      draft.color = trimmed;
      draft.step = 'material';
      break;
    case 'material':
      draft.material = trimmed === '-' ? '' : trimmed.slice(0, 100);
      draft.step = 'condition';
      break;
    case 'avitoUrl':
      if (trimmed !== '-' && !isHttpsUrl(trimmed)) {
        await sendMessage(chatId, 'Похоже, это не ссылка. Пришли ссылку вида https://www.avito.ru/... или «-».');
        return;
      }
      draft.avitoUrl = trimmed === '-' ? '' : trimmed;
      draft.step = 'description';
      break;
    case 'description':
      draft.description = trimmed.slice(0, MAX_DESCRIPTION_LENGTH);
      draft.step = 'photos';
      break;
    case 'category':
    case 'condition':
      await sendMessage(chatId, 'Выбери вариант на кнопках выше 👆');
      return;
    case 'photos':
      await sendMessage(chatId, 'Жду фото (или нажми «Готово»).');
      return;
    case 'confirm':
      await sendMessage(chatId, 'Нажми «Опубликовать» или «Отменить» на карточке выше 👆');
      return;
    default:
      return;
  }

  await saveDraft(chatId, draft);
  await askNext(chatId, draft);
}

async function handlePhoto(chatId, draft, photos) {
  if (draft.step !== 'photos') {
    await sendMessage(chatId, 'Сейчас фото не нужны — заполним остальные поля, потом дойдём до фото.');
    return;
  }

  const largest = photos[photos.length - 1];
  const { buffer, contentType } = await downloadFile(largest.file_id);
  const url = await uploadPhoto(`draft-${chatId}`, largest.file_unique_id, buffer, contentType);
  const count = await addDraftPhoto(chatId, url);

  if (count > MAX_PHOTOS) {
    await removeLastDraftPhoto(chatId);
    await sendMessage(chatId, `Уже загружено максимум (${MAX_PHOTOS}). Нажми «Готово».`, { reply_markup: photosKeyboard });
    return;
  }

  if (count === MAX_PHOTOS) {
    draft.step = 'confirm';
    await saveDraft(chatId, draft);
    await sendMessage(chatId, `Загружено ${count} фото — это максимум.`);
    await sendConfirmation(chatId, draft, await getDraftPhotos(chatId));
  } else {
    await sendMessage(chatId, `Фото добавлено (${count}/${MAX_PHOTOS}). Пришли ещё или нажми «Готово».`, { reply_markup: photosKeyboard });
  }
}

async function clearButtons(chatId, messageId) {
  try { await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] }); } catch {}
}

const ITEMS_LIST_LIMIT = 10;

async function listItemsForStatus(chatId) {
  const products = await getProducts();
  if (products.length === 0) {
    await sendMessage(chatId, 'Пока нет ни одного товара. Добавь первый: /additem');
    return;
  }

  const recent = products.slice(0, ITEMS_LIST_LIMIT);
  await sendMessage(chatId, `Последние ${recent.length} товаров — нажми кнопку, чтобы изменить статус:`);

  for (const p of recent) {
    const caption =
      `${STATUS[p.status]?.emoji || '🟢'} <b>${p.brand ? escapeHtml(p.brand) + ' ' : ''}${escapeHtml(p.name)}</b>\n` +
      `Размер ${escapeHtml(p.size)} · ${formatPriceRub(p.price)}\n` +
      `Статус: ${escapeHtml(STATUS[p.status]?.label || 'В наличии')}`;

    if (p.photos && p.photos[0]) {
      await sendPhoto(chatId, p.photos[0], caption, { reply_markup: statusKeyboard(p.id) });
    } else {
      await sendMessage(chatId, caption, { reply_markup: statusKeyboard(p.id) });
    }
  }
}

// Не привязан к draft — кнопки статуса приходят из /items, где никакого
// черновика анкеты нет вообще (в отличие от остальных callback'ов ниже).
async function handleStatusCallback(data, callbackId) {
  const [, id, newStatus] = data.split(':');
  if (!STATUS[newStatus]) { await answerCallbackQuery(callbackId, 'Неизвестный статус'); return; }
  const updated = await setProductStatus(id, newStatus);
  if (!updated) { await answerCallbackQuery(callbackId, 'Товар не найден'); return; }
  console.log(JSON.stringify({ event: newStatus === 'sold' ? 'product_sold' : newStatus === 'reserved' ? 'product_reserved' : 'product_available', productId: id }));
  await answerCallbackQuery(callbackId, `Статус: ${STATUS[newStatus].label}`);
}

async function handleCallback(chatId, draft, data, callbackId, messageId) {
  if (data.startsWith('cat:')) {
    if (draft.step !== 'category') { await answerCallbackQuery(callbackId, 'Уже выбрано'); return; }
    draft.category = data.slice(4);
    draft.step = 'brand';
    await saveDraft(chatId, draft);
    await answerCallbackQuery(callbackId, CATEGORIES[draft.category]);
    await askNext(chatId, draft);
    return;
  }

  if (data.startsWith('cond:')) {
    if (draft.step !== 'condition') { await answerCallbackQuery(callbackId, 'Уже выбрано'); return; }
    draft.condition = data.slice(5);
    draft.step = 'avitoUrl';
    await saveDraft(chatId, draft);
    await answerCallbackQuery(callbackId, draft.condition);
    await askNext(chatId, draft);
    return;
  }

  if (data === 'photos_done') {
    if (draft.step !== 'photos') { await answerCallbackQuery(callbackId, 'Уже подтверждено'); return; }
    const photos = await getDraftPhotos(chatId);
    if (photos.length === 0) {
      await answerCallbackQuery(callbackId, 'Нужно хотя бы одно фото');
      return;
    }
    draft.step = 'confirm';
    await saveDraft(chatId, draft);
    await answerCallbackQuery(callbackId, 'Готово');
    await sendConfirmation(chatId, draft, photos);
    return;
  }

  if (data === 'publish') {
    if (draft.step !== 'confirm') { await answerCallbackQuery(callbackId, 'Черновик устарел'); return; }
    const photos = await getDraftPhotos(chatId);
    if (photos.length === 0) { await answerCallbackQuery(callbackId, 'Фото потерялись, начни заново: /start'); return; }
    const product = {
      id: randomUUID(),
      category: draft.category,
      brand: draft.brand || '',
      name: draft.name,
      price: draft.price,
      size: draft.size,
      color: draft.color,
      material: draft.material || '',
      condition: draft.condition,
      avitoUrl: draft.avitoUrl || '',
      description: draft.description === '-' ? '' : draft.description,
      status: 'available',
      photos,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const published = await addProduct(product);
    await clearDraft(chatId);
    await answerCallbackQuery(callbackId, 'Опубликовано!');
    await clearButtons(chatId, messageId);
    await sendMessage(chatId, `✅ «${escapeHtml(product.name)}» опубликовано на сайте:\nhttps://avito-misha.vercel.app/catalog/${published.slug}`);
    return;
  }

  if (data === 'cancel') {
    await clearDraft(chatId);
    await answerCallbackQuery(callbackId, 'Отменено');
    await clearButtons(chatId, messageId);
    await sendMessage(chatId, 'Черновик отменён.');
    return;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.ADMIN_BOT_SECRET;
  if (!secret || req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const update = req.body || {};
  const message = update.message;
  const callback = update.callback_query;
  const chat = message?.chat || callback?.message?.chat;

  if (!chat) {
    res.status(200).json({ ok: true });
    return;
  }

  const chatId = chat.id;

  // Всё, что может кинуть исключение (в т.ч. sendMessage — Telegram может
  // отказать по любой причине: чужой аккаунт заблокировал бота, чат не
  // существует и т.п.), должно остаться внутри try — иначе необработанное
  // исключение превращается в 500 для Telegram, который начинает ретраить
  // вебхук на ровном месте.
  try {
    const adminChatIds = (process.env.ADMIN_CHAT_ID || '')
      .split(',')
      .map(function(s) { return s.trim(); })
      .filter(Boolean);

    if (adminChatIds.length === 0) {
      await sendMessage(chatId, `Доступ пока не настроен.\n\nТвой chat_id: <code>${chatId}</code>\n\nОтправь это разработчику, чтобы включить доступ.`);
      res.status(200).json({ ok: true });
      return;
    }

    if (!adminChatIds.includes(String(chatId))) {
      await sendMessage(chatId, `У тебя нет доступа к этому боту.\n\nТвой chat_id: <code>${chatId}</code>\n\nПопроси владельца добавить его в список админов.`);
      res.status(200).json({ ok: true });
      return;
    }

    if (callback?.data?.startsWith('status:')) {
      await handleStatusCallback(callback.data, callback.id);
      res.status(200).json({ ok: true });
      return;
    }

    let draft = await getDraft(chatId);

    if (callback) {
      if (!draft) { await answerCallbackQuery(callback.id, 'Черновик не найден'); res.status(200).json({ ok: true }); return; }
      await handleCallback(chatId, draft, callback.data, callback.id, callback.message?.message_id);
      res.status(200).json({ ok: true });
      return;
    }

    if (message?.text === '/items') {
      await listItemsForStatus(chatId);
      res.status(200).json({ ok: true });
      return;
    }

    if (message?.text === '/start' || message?.text === '/additem' || !draft) {
      await clearDraft(chatId);
      draft = newDraft();
      await saveDraft(chatId, draft);
      await askCategory(chatId);
      res.status(200).json({ ok: true });
      return;
    }

    if (message?.photo) {
      await handlePhoto(chatId, draft, message.photo);
    } else if (message?.text) {
      await handleText(chatId, draft, message.text);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    try { await sendMessage(chatId, 'Что-то пошло не так. Попробуй /start заново.'); } catch {}
    res.status(200).json({ ok: true });
  }
}
