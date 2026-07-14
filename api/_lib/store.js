// Общий доступ к данным каталога и черновиков в Vercel Blob.

import { put, head, del } from '@vercel/blob';

const PRODUCTS_PATH = 'data/products.json';

async function readJson(pathname) {
  let blob;
  try {
    blob = await head(pathname);
  } catch {
    return null;
  }
  // head() hits Vercel's storage API directly (strongly consistent), but the
  // public blob.url is served through a CDN edge that can briefly return a
  // cached response for the same URL right after an overwrite. Busting with
  // the blob's own uploadedAt timestamp forces a fresh edge fetch.
  const bust = encodeURIComponent(new Date(blob.uploadedAt).getTime());
  const url = blob.url + (blob.url.includes('?') ? '&' : '?') + 'v=' + bust;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function writeJson(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export async function getProducts() {
  const data = await readJson(PRODUCTS_PATH);
  return Array.isArray(data) ? data : [];
}

export async function addProduct(product) {
  const products = await getProducts();
  products.unshift(product);
  await writeJson(PRODUCTS_PATH, products);
  return product;
}

function draftPath(chatId) {
  return `data/drafts/${chatId}.json`;
}

export async function getDraft(chatId) {
  return readJson(draftPath(chatId));
}

export async function saveDraft(chatId, draft) {
  await writeJson(draftPath(chatId), draft);
}

export async function deleteDraft(chatId) {
  try {
    const blob = await head(draftPath(chatId));
    await del(blob.url);
  } catch {
    // черновика не было — ничего не делаем
  }
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
