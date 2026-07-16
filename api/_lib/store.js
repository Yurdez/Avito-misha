// Данные каталога и черновиков анкеты.
// Redis — для JSON-данных, списки читаются/пишутся атомарными LPUSH/RPUSH,
// чтобы параллельные запросы (альбом фото, два админа публикуют одновременно)
// не перетирали друг друга при чтении-изменении-записи.
// Vercel Blob — только для файлов фото (нужен CDN, консистентность не критична).

import { put } from '@vercel/blob';
import getRedis from './redis.js';

const PRODUCTS_KEY = 'products';
const DRAFT_TTL_SECONDS = 60 * 60; // черновик анкеты живёт час без активности

export async function getProducts() {
  const redis = await getRedis();
  const raw = await redis.lRange(PRODUCTS_KEY, 0, -1);
  return raw.map((s) => JSON.parse(s));
}

export async function addProduct(product) {
  const redis = await getRedis();
  await redis.lPush(PRODUCTS_KEY, JSON.stringify(product));
  return product;
}

function draftKey(chatId) {
  return `draft:${chatId}`;
}

function draftPhotosKey(chatId) {
  return `draft:${chatId}:photos`;
}

export async function getDraft(chatId) {
  const redis = await getRedis();
  const raw = await redis.get(draftKey(chatId));
  return raw ? JSON.parse(raw) : null;
}

export async function saveDraft(chatId, draft) {
  const redis = await getRedis();
  await redis.set(draftKey(chatId), JSON.stringify(draft), { EX: DRAFT_TTL_SECONDS });
}

export async function clearDraft(chatId) {
  const redis = await getRedis();
  await redis.del([draftKey(chatId), draftPhotosKey(chatId)]);
}

// Атомарно добавляет фото и возвращает итоговое количество — так параллельно
// пришедшие фото (альбом из галереи) не затирают друг друга.
export async function addDraftPhoto(chatId, url) {
  const redis = await getRedis();
  const key = draftPhotosKey(chatId);
  const count = await redis.rPush(key, url);
  await redis.expire(key, DRAFT_TTL_SECONDS);
  return count;
}

export async function removeLastDraftPhoto(chatId) {
  const redis = await getRedis();
  await redis.rPop(draftPhotosKey(chatId));
}

export async function getDraftPhotos(chatId) {
  const redis = await getRedis();
  return redis.lRange(draftPhotosKey(chatId), 0, -1);
}

export async function uploadPhoto(folder, name, buffer, contentType) {
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const blob = await put(`data/photos/${folder}/${name}.${ext}`, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}
