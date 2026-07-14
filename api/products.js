// Публичный список товаров для каталога на сайте.

import { getProducts } from './_lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const products = await getProducts();
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
  res.status(200).json(products);
}
