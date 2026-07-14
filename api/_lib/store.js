// Данные каталога и черновиков анкеты.
// Redis — для JSON-данных (нужна мгновенная консистентность между сообщениями бота).
// Vercel Blob — только для файлов фото (нужен CDN, консистентность не критична).

import { put } from '@vercel/blob';
import getRedis from './redis.js';

const PRODUCTS_KEY = 'products';
const DRAFT_TTL_SECONDS = 60 * 60; // черновик анкеты живёт час без активности

export async function getProducts() {
  const redis = await getRedis();
  const raw = await redis.get(PRODUCTS_KEY);
  const data = raw ? JSON.parse(raw) : [];
  return Array.isArray(data) ? data : [];
}

export async function addProduct(product) {
  const redis = await getRedis();
  const products = await getProducts();
  products.unshift(product);
  await redis.set(PRODUCTS_KEY, JSON.stringify(products));
  return product;
}

function draftKey(chatId) {
  return `draft:${chatId}`;
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

export async function deleteDraft(chatId) {
  const redis = await getRedis();
  await redis.del(draftKey(chatId));
}

export async function uploadPhoto(productId, index, buffer, contentType) {
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const blob = await put(`data/photos/${productId}/${index}.${ext}`, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}
