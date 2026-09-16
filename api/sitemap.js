// Динамический sitemap.xml — товары подтягиваются из Redis автоматически,
// отдельно обновлять файл при добавлении товара не нужно.

import { getProducts } from './_lib/store.js';
import { SITE_URL, CATEGORY_SLUGS } from './_lib/render.js';

function urlEntry(path, lastmod) {
  return `<url><loc>${SITE_URL}${path}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`;
}

export default async function handler(req, res) {
  const products = await getProducts();

  const staticUrls = [
    urlEntry('/'),
    urlEntry('/catalog'),
    urlEntry('/contacts.html'),
    urlEntry('/privacy.html'),
    ...Object.values(CATEGORY_SLUGS).map((slug) => urlEntry(`/catalog/${slug}`)),
  ];
  const productUrls = products.map((p) => urlEntry(`/catalog/${p.slug}`, p.updatedAt || p.createdAt));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...productUrls].join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}
