// Данные каталога и черновиков анкеты.
// Redis — для JSON-данных, списки читаются/пишутся атомарными LPUSH/RPUSH,
// чтобы параллельные запросы (альбом фото, два админа публикуют одновременно)
// не перетирали друг друга при чтении-изменении-записи.
// Vercel Blob — только для файлов фото (нужен CDN, консистентность не критична).

import { put } from '@vercel/blob';
import getRedis from './redis.js';
import { slugify } from './render.js';

const PRODUCTS_KEY = 'products';
const SKU_COUNTER_KEY = 'sku_counter';
const DRAFT_TTL_SECONDS = 60 * 60; // черновик анкеты живёт час без активности

function formatSku(n) {
  return 'AV-' + String(n).padStart(3, '0');
}

// Товары, сохранённые до появления полей brand/status/slug/material/avitoUrl,
// не переписываются в Redis — дефолты применяются при каждом чтении, чтобы
// старые карточки не пропадали и не требовали ручной миграции данных.
function normalizeProduct(p) {
  return {
    brand: '',
    material: '',
    avitoUrl: '',
    measurements: null,
    defect: '',
    status: 'available',
    updatedAt: p.createdAt,
    ...p,
    slug: p.slug || slugify(`${p.brand || ''} ${p.name}`, String(p.id).slice(0, 8)),
    // Старые товары без sku показывают короткий ID вместо артикула — не
    // выдаём задним числом номера, которые нарушили бы хронологию счётчика.
    sku: p.sku || 'AV-' + String(p.id).slice(0, 3).toUpperCase(),
  };
}

export async function getProducts() {
  const redis = await getRedis();
  const raw = await redis.lRange(PRODUCTS_KEY, 0, -1);
  return raw.map((s) => normalizeProduct(JSON.parse(s)));
}

export async function getProductBySlug(slug) {
  const products = await getProducts();
  return products.find((p) => p.slug === slug) || null;
}

export async function addProduct(product) {
  const redis = await getRedis();
  const seq = await redis.incr(SKU_COUNTER_KEY);
  const withSlug = {
    ...product,
    sku: formatSku(seq),
    slug: slugify(`${product.brand || ''} ${product.name}`, String(product.id).slice(0, 8)),
  };
  await redis.lPush(PRODUCTS_KEY, JSON.stringify(withSlug));
  return withSlug;
}

// Похожие товары для страницы товара: сперва та же категория, при нехватке
// добавляем тот же бренд — оба списка исключают текущий товар и всё проданное,
// чтобы не вести на тупиковую страницу.
export async function getRelatedProducts(product, limit = 4) {
  const all = await getProducts();
  const pool = all.filter((p) => p.id !== product.id && p.status !== 'sold');

  const sameCategory = pool.filter((p) => p.category === product.category);
  const result = sameCategory.slice(0, limit);

  if (result.length < limit && product.brand) {
    const usedIds = new Set(result.map((p) => p.id));
    const sameBrand = pool.filter((p) => p.brand === product.brand && !usedIds.has(p.id));
    result.push(...sameBrand.slice(0, limit - result.length));
  }

  return result;
}

// Список — не хэш, поэтому обновление статуса одной вещи требует найти её
// позицию и переписать именно этот элемент (lSet), не трогая остальные —
// LPUSH/RPUSH тут не подходят, порядок и содержимое соседних записей важны.
export async function setProductStatus(id, status) {
  const redis = await getRedis();
  const raw = await redis.lRange(PRODUCTS_KEY, 0, -1);
  const index = raw.findIndex((s) => JSON.parse(s).id === id);
  if (index === -1) return null;
  const updated = { ...JSON.parse(raw[index]), status, updatedAt: new Date().toISOString() };
  await redis.lSet(PRODUCTS_KEY, index, JSON.stringify(updated));
  return normalizeProduct(updated);
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
