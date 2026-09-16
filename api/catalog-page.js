// SSR-страница каталога: /catalog — доступна и индексируется без JS,
// фильтры/сортировка работают через query-string (GET-форма).

import { getProducts } from './_lib/store.js';
import {
  pageShell, productCardHtml, breadcrumbsHtml, breadcrumbsJsonLd,
  escapeHtml, escapeAttr, CATEGORIES, CATEGORY_SLUGS, SITE_URL,
} from './_lib/render.js';

function unique(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const q = req.query || {};
  const category = typeof q.category === 'string' ? q.category : '';
  const brand = typeof q.brand === 'string' ? q.brand : '';
  const size = typeof q.size === 'string' ? q.size : '';
  const search = typeof q.q === 'string' ? q.q.trim().toLowerCase() : '';
  const minPrice = q.minPrice ? Number(q.minPrice) : null;
  const maxPrice = q.maxPrice ? Number(q.maxPrice) : null;
  const sort = typeof q.sort === 'string' ? q.sort : 'new';

  const all = await getProducts();
  const listed = all.filter((p) => p.status !== 'sold');

  const availableCategories = unique(listed.map((p) => p.category)).filter((c) => CATEGORIES[c]);
  const availableBrands = unique(listed.map((p) => p.brand));
  const availableSizes = unique(listed.map((p) => p.size));

  let visible = listed;
  if (category) visible = visible.filter((p) => p.category === category);
  if (brand) visible = visible.filter((p) => p.brand === brand);
  if (size) visible = visible.filter((p) => p.size === size);
  if (search) visible = visible.filter((p) =>
    (p.brand + ' ' + p.name + ' ' + (p.description || '')).toLowerCase().includes(search));
  if (minPrice != null && !Number.isNaN(minPrice)) visible = visible.filter((p) => p.price >= minPrice);
  if (maxPrice != null && !Number.isNaN(maxPrice)) visible = visible.filter((p) => p.price <= maxPrice);

  if (sort === 'cheap') visible = [...visible].sort((a, b) => a.price - b.price);
  else if (sort === 'expensive') visible = [...visible].sort((a, b) => b.price - a.price);
  // 'new' — порядок уже newest-first (см. addProduct/LPUSH), доп. сортировка не нужна

  const hasFilters = Boolean(category || brand || size || search || minPrice || maxPrice || (sort && sort !== 'new'));

  const categoryLabel = category && CATEGORIES[category];
  const title = categoryLabel
    ? `${categoryLabel} — купить б/у брендовые вещи | AVEREST`
    : 'Каталог — брендовые вещи из секонд-хенда | AVEREST';
  const description = categoryLabel
    ? `${categoryLabel} б/у от AVEREST: реальные фото, честное состояние, доставка по России.`
    : 'Каталог брендовых вещей из секонд-хенда: куртки, джинсы, обувь и аксессуары. Реальные фото, честное состояние, доставка по России.';

  const categoryHref = category && CATEGORY_SLUGS[category] ? `/catalog/${CATEGORY_SLUGS[category]}` : '/catalog';
  const canonical = categoryLabel ? categoryHref : '/catalog';
  const breadcrumbItems = category
    ? [{ label: 'Главная', href: '/' }, { label: 'Каталог', href: '/catalog' }, { label: categoryLabel || 'Каталог' }]
    : [{ label: 'Главная', href: '/' }, { label: 'Каталог' }];

  const categoryOptions = ['<option value="">Все категории</option>']
    .concat(availableCategories.map((c) =>
      `<option value="${escapeAttr(c)}"${c === category ? ' selected' : ''}>${escapeHtml(CATEGORIES[c])}</option>`))
    .join('');

  const brandOptions = ['<option value="">Все бренды</option>']
    .concat(availableBrands.map((b) =>
      `<option value="${escapeAttr(b)}"${b === brand ? ' selected' : ''}>${escapeHtml(b)}</option>`))
    .join('');

  const sizeOptions = ['<option value="">Любой размер</option>']
    .concat(availableSizes.map((s) =>
      `<option value="${escapeAttr(s)}"${s === size ? ' selected' : ''}>${escapeHtml(s)}</option>`))
    .join('');

  const sortOptions = [
    ['new', 'Новые'], ['cheap', 'Дешевле'], ['expensive', 'Дороже'],
  ].map(([val, label]) => `<option value="${val}"${sort === val ? ' selected' : ''}>${label}</option>`).join('');

  const grid = visible.length
    ? `<div class="products">${visible.map(productCardHtml).join('')}</div>`
    : `<p class="catalog__status">${listed.length === 0 ? 'Пока нет товаров — скоро появятся. Загляните позже или подпишитесь на новинки в Telegram.' : 'Ничего не найдено по этим фильтрам. Попробуйте изменить условия поиска.'}</p>`;

  const bodyHtml = `
<section class="catalog-page">
  <div class="container">
    ${breadcrumbsHtml(breadcrumbItems)}
    <h1 class="section-title">${escapeHtml(categoryLabel || 'Каталог')}</h1>

    <details class="filter-panel" ${hasFilters ? 'open' : ''}>
      <summary>Фильтры и сортировка</summary>
      <form method="get" action="/catalog" class="filter-form">
        <div class="filter-form__row">
          <input type="text" name="q" placeholder="Поиск: бренд, название..." value="${escapeAttr(search)}"/>
        </div>
        <div class="filter-form__row filter-form__row--grid">
          <select name="category">${categoryOptions}</select>
          <select name="brand">${brandOptions}</select>
          <select name="size">${sizeOptions}</select>
          <select name="sort">${sortOptions}</select>
        </div>
        <div class="filter-form__row filter-form__row--grid">
          <input type="number" name="minPrice" placeholder="Цена от" value="${escapeAttr(minPrice || '')}" min="0"/>
          <input type="number" name="maxPrice" placeholder="Цена до" value="${escapeAttr(maxPrice || '')}" min="0"/>
          <button type="submit" class="btn btn--sm" data-track="filter_catalog">Применить</button>
          ${hasFilters ? '<a href="/catalog" class="btn btn--outline btn--sm">Сбросить</a>' : ''}
        </div>
      </form>
    </details>

    ${grid}
  </div>
</section>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
  res.status(200).send(pageShell({
    title,
    description,
    canonical,
    bodyHtml,
    activeNav: 'catalog',
    jsonLd: [
      breadcrumbsJsonLd(breadcrumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: visible.slice(0, 30).map((p, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/catalog/${p.slug}`,
        })),
      },
    ],
    extraScripts: `<script>
document.querySelectorAll('.filter-form select').forEach(function(s){s.addEventListener('change',function(){s.form.submit();});});
if (window.track) {
  ${category ? `window.track('view_category', { category: ${JSON.stringify(category).replace(/</g, '\\u003c')} });` : ''}
  ${search ? `window.track('search_product', { q: ${JSON.stringify(search).replace(/</g, '\\u003c')} });` : ''}
}
</script>`,
  }));
}
