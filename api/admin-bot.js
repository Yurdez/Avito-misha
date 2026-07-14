// Vercel serverless webhook — приём новых товаров от владельца через Telegram.

import { randomUUID } from 'node:crypto';
import { getDraft, saveDraft, deleteDraft, addProduct, uploadPhoto } from './_lib/store.js';
import { sendMessage, sendPhoto, answerCallbackQuery, downloadFile } from './_lib/telegram.js';

const CATEGORIES = {
  jacket: 'Куртки',
  jeans: 'Джинсы',
  shoes: 'Обувь',
  dress: 'Платья',
  accessories: 'Аксессуары',
};

const MAX_PHOTOS = 5;

const categoryKeyboard = {
  inline_keyboard: [
    [{ text: 'Куртки', callback_data: 'cat:jacket' }, { text: 'Джинсы', callback_data: 'cat:jeans' }],
    [{ text: 'Обувь', callback_data: 'cat:shoes' }, { text: 'Платья', callback_data: 'cat:dress' }],
    [{ text: 'Аксессуары', callback_data: 'cat:accessories' }],
  ],
};

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
  return { step: 'category', photos: [] };
}

function formatPrice(n) {
  return n.toLocaleString('ru-RU') + ' ₽';
}

async function askCategory(chatId) {
  await sendMessage(chatId, 'Добавляем новую вещь.\n\nВыбери категорию:', { reply_markup: categoryKeyboard });
}

async function askNext(chatId, draft) {
  switch (draft.step) {
    case 'name':
      return sendMessage(chatId, 'Название товара (например: «Куртка демисезонная Zara»):');
    case 'price':
      return sendMessage(chatId, 'Цена в рублях (только число, например 1800):');
    case 'size':
      return sendMessage(chatId, 'Размер (например: M, 32/32, 42):');
    case 'color':
      return sendMessage(chatId, 'Цвет:');
    case 'condition':
      return sendMessage(chatId, 'Состояние:', { reply_markup: conditionKeyboard });
    case 'description':
      return sendMessage(chatId, 'Короткое описание/дефекты (или отправь «-», если нечего добавить):');
    case 'photos':
      return sendMessage(chatId, `Пришли фото товара (от 1 до ${MAX_PHOTOS} штук, можно по одному). Когда закончишь — нажми «Готово».`, { reply_markup: photosKeyboard });
    default:
      return null;
  }
}

async function sendConfirmation(chatId, draft) {
  const caption =
    `<b>${draft.name}</b>\n` +
    `Категория: ${CATEGORIES[draft.category]}\n` +
    `Размер: ${draft.size}\n` +
    `Цвет: ${draft.color}\n` +
    `Состояние: ${draft.condition}\n` +
    `Цена: ${formatPrice(draft.price)}\n` +
    (draft.description && draft.description !== '-' ? `\n${draft.description}\n` : '\n') +
    `\nФото: ${draft.photos.length} шт.\n\nОпубликовать?`;

  await sendPhoto(chatId, draft.photos[0], caption, { reply_markup: confirmKeyboard });
}

async function handleText(chatId, draft, text) {
  const trimmed = text.trim();

  if (trimmed === '/cancel') {
    await deleteDraft(chatId);
    await sendMessage(chatId, 'Черновик отменён.');
    return;
  }

  switch (draft.step) {
    case 'name':
      draft.name = trimmed;
      draft.step = 'price';
      break;
    case 'price': {
      const price = parseInt(trimmed.replace(/\D/g, ''), 10);
      if (!price) {
        await sendMessage(chatId, 'Не понял цену. Пришли число, например 1800.');
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
      draft.step = 'condition';
      break;
    case 'description':
      draft.description = trimmed;
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
  if (draft.photos.length >= MAX_PHOTOS) {
    await sendMessage(chatId, `Уже загружено максимум (${MAX_PHOTOS}). Нажми «Готово».`, { reply_markup: photosKeyboard });
    return;
  }

  const largest = photos[photos.length - 1];
  const { buffer, contentType } = await downloadFile(largest.file_id);
  const tempId = draft.tempId || (draft.tempId = randomUUID());
  const url = await uploadPhoto(tempId, draft.photos.length + 1, buffer, contentType);
  draft.photos.push(url);
  await saveDraft(chatId, draft);

  if (draft.photos.length >= MAX_PHOTOS) {
    draft.step = 'confirm';
    await saveDraft(chatId, draft);
    await sendMessage(chatId, `Загружено ${draft.photos.length} фото — это максимум.`);
    await sendConfirmation(chatId, draft);
  } else {
    await sendMessage(chatId, `Фото добавлено (${draft.photos.length}/${MAX_PHOTOS}). Пришли ещё или нажми «Готово».`, { reply_markup: photosKeyboard });
  }
}

async function handleCallback(chatId, draft, data, callbackId) {
  if (data.startsWith('cat:')) {
    if (draft.step !== 'category') { await answerCallbackQuery(callbackId, 'Уже выбрано'); return; }
    draft.category = data.slice(4);
    draft.step = 'name';
    await saveDraft(chatId, draft);
    await answerCallbackQuery(callbackId, CATEGORIES[draft.category]);
    await askNext(chatId, draft);
    return;
  }

  if (data.startsWith('cond:')) {
    if (draft.step !== 'condition') { await answerCallbackQuery(callbackId, 'Уже выбрано'); return; }
    draft.condition = data.slice(5);
    draft.step = 'description';
    await saveDraft(chatId, draft);
    await answerCallbackQuery(callbackId, draft.condition);
    await askNext(chatId, draft);
    return;
  }

  if (data === 'photos_done') {
    if (draft.photos.length === 0) {
      await answerCallbackQuery(callbackId, 'Нужно хотя бы одно фото');
      return;
    }
    draft.step = 'confirm';
    await saveDraft(chatId, draft);
    await answerCallbackQuery(callbackId, 'Готово');
    await sendConfirmation(chatId, draft);
    return;
  }

  if (data === 'publish') {
    if (draft.step !== 'confirm') { await answerCallbackQuery(callbackId, 'Черновик устарел'); return; }
    const product = {
      id: randomUUID(),
      category: draft.category,
      name: draft.name,
      price: draft.price,
      size: draft.size,
      color: draft.color,
      condition: draft.condition,
      description: draft.description === '-' ? '' : draft.description,
      photos: draft.photos,
      createdAt: new Date().toISOString(),
    };
    await addProduct(product);
    await deleteDraft(chatId);
    await answerCallbackQuery(callbackId, 'Опубликовано!');
    await sendMessage(chatId, `✅ «${product.name}» опубликовано на сайте:\nhttps://avito-misha.vercel.app/#catalog`);
    return;
  }

  if (data === 'cancel') {
    await deleteDraft(chatId);
    await answerCallbackQuery(callbackId, 'Отменено');
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
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
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
  const adminChatId = process.env.ADMIN_CHAT_ID;

  if (!adminChatId) {
    await sendMessage(chatId, `Доступ пока не настроен.\n\nТвой chat_id: <code>${chatId}</code>\n\nОтправь это разработчику, чтобы включить доступ.`);
    res.status(200).json({ ok: true });
    return;
  }

  if (String(chatId) !== String(adminChatId)) {
    res.status(200).json({ ok: true });
    return;
  }

  try {
    let draft = await getDraft(chatId);

    if (callback) {
      if (!draft) { await answerCallbackQuery(callback.id, 'Черновик не найден'); res.status(200).json({ ok: true }); return; }
      await handleCallback(chatId, draft, callback.data, callback.id);
      res.status(200).json({ ok: true });
      return;
    }

    if (message?.text === '/start' || message?.text === '/additem' || !draft) {
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
