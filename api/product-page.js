// SSR-страница товара: /catalog/:slug — уникальный индексируемый URL с
// Product JSON-LD, галереей и Telegram/Avito CTA.

import { getProductBySlug } from './_lib/store.js';
import {
  pageShell, breadcrumbsHtml, breadcrumbsJsonLd, productJsonLd,
  statusBadgeHtml, telegramLink, bookingMessage, questionMessage,
  escapeHtml, escapeAttr, formatPrice, isHttpsUrl, CATEGORIES, SITE_URL,
} from './_lib/render.js';

function notFoundPage(res) {
  const bodyHtml = `
<section class="catalog-page">
  <div class="container" style="text-align:center;padding:80px 0;">
    <h1 class="section-title">Товар не найден</h1>
    <p style="opacity:0.6;margin-bottom:32px;">Возможно, ссылка устарела или вещь уже сняли с продажи.</p>
    <a href="/catalog" class="btn">Смотреть каталог</a>
  </div>
</section>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(404).send(pageShell({
    title: 'Товар не найден | AVEREST',
    description: 'Такого товара нет в каталоге AVEREST.',
    canonical: '/catalog',
    bodyHtml,
    activeNav: 'catalog',
  }));
}

function galleryHtml(photos, alt) {
  const httpsPhotos = (photos || []).filter(isHttpsUrl);
  const safe = httpsPhotos.length ? httpsPhotos : ['https://placehold.co/800x1000/111/c8a96e?text=AVEREST'];
  const thumbs = safe.length > 1
    ? `<div class="gallery__thumbs">${safe.map((url, i) =>
        `<button type="button" class="gallery__thumb${i === 0 ? ' active' : ''}" data-src="${escapeAttr(url)}"><img src="${escapeAttr(url)}" alt="" loading="lazy"/></button>`).join('')}</div>`
    : '';
  return `<div class="gallery">
    <div class="gallery__main"><img src="${escapeAttr(safe[0])}" alt="${escapeAttr(alt)}" id="galleryMain"/></div>
    ${thumbs}
  </div>`;
}

function measurementsHtml(measurements) {
  if (!measurements || typeof measurements !== 'object') return '';
  const rows = Object.entries(measurements)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)} см</td></tr>`)
    .join('');
  if (!rows) return '';
  return `<table class="measurements-table">${rows}</table>
  <p class="measurements-note">Замеры сделаны вручную, возможна погрешность 1–2 см.</p>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const slug = typeof req.query?.slug === 'string' ? req.query.slug : '';
  const p = slug ? await getProductBySlug(slug) : null;

  if (!p) {
    notFoundPage(res);
    return;
  }

  const url = `${SITE_URL}/catalog/${p.slug}`;
  const fullName = (p.brand ? p.brand + ' ' : '') + p.name;
  const categoryLabel = CATEGORIES[p.category] || '';
  const breadcrumbItems = [
    { label: 'Главная', href: '/' },
    { label: 'Каталог', href: '/catalog' },
    ...(categoryLabel ? [{ label: categoryLabel, href: `/catalog?category=${p.category}` }] : []),
    { label: fullName },
  ];

  const isSold = p.status === 'sold';

  const ctaHtml = isSold
    ? `<div class="product-detail__sold">
         <p>Эта вещь уже нашла своего владельца.</p>
         <div class="product-detail__cta-row">
           <a href="/catalog" class="btn">Смотреть новые поступления</a>
           <a href="${telegramLink('Здравствуйте! Хочу получать уведомления о новых поступлениях AVEREST.')}" target="_blank" rel="noopener" class="btn btn--outline" data-track="click_telegram" data-track-params='{"place":"product_sold"}'>Получать новинки в Telegram</a>
         </div>
       </div>`
    : `<div class="product-detail__cta-row">
         <a href="${telegramLink(bookingMessage(p))}" target="_blank" rel="noopener" class="btn btn--full" data-track="click_telegram" data-track-params='{"place":"product_book"}'>Забронировать в Telegram</a>
         <a href="${telegramLink(questionMessage(p))}" target="_blank" rel="noopener" class="btn btn--outline btn--full" data-track="click_telegram" data-track-params='{"place":"product_question"}'>Задать вопрос</a>
         ${p.avitoUrl ? `<a href="${escapeAttr(p.avitoUrl)}" target="_blank" rel="noopener" class="btn btn--outline btn--full" data-track="click_avito">Открыть объявление на Авито</a>` : ''}
       </div>`;

  const bodyHtml = `
<section class="product-detail">
  <div class="container">
    ${breadcrumbsHtml(breadcrumbItems)}
    <div class="product-detail__grid">
      ${galleryHtml(p.photos, fullName)}
      <div class="product-detail__info">
        ${p.brand ? `<p class="product-detail__brand">${escapeHtml(p.brand)}</p>` : ''}
        <h1 class="product-detail__title">${escapeHtml(p.name)}</h1>
        <p class="product-detail__price">${formatPrice(p.price)}</p>
        ${statusBadgeHtml(p.status)}

        <dl class="product-detail__specs">
          <div><dt>Размер</dt><dd>${escapeHtml(p.size)}</dd></div>
          ${p.color ? `<div><dt>Цвет</dt><dd>${escapeHtml(p.color)}</dd></div>` : ''}
          ${p.material ? `<div><dt>Материал</dt><dd>${escapeHtml(p.material)}</dd></div>` : ''}
          <div><dt>Состояние</dt><dd>${escapeHtml(p.condition)}</dd></div>
        </dl>

        ${p.description ? `<p class="product-detail__desc">${escapeHtml(p.description)}</p>` : ''}
        ${measurementsHtml(p.measurements)}
        ${ctaHtml}
      </div>
    </div>
  </div>
</section>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
  res.status(200).send(pageShell({
    title: `${fullName} — купить б/у | AVEREST`,
    description: `${fullName}, размер ${p.size}, ${p.condition?.toLowerCase() || ''} состояние, ${formatPrice(p.price)}. ${categoryLabel} с доставкой по России.`,
    canonical: `/catalog/${p.slug}`,
    ogImage: (p.photos || []).find(isHttpsUrl),
    bodyHtml,
    activeNav: 'catalog',
    jsonLd: [productJsonLd(p, url), breadcrumbsJsonLd(breadcrumbItems)],
    extraScripts: `<script>
document.querySelectorAll('.gallery__thumb').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.getElementById('galleryMain').src = btn.getAttribute('data-src');
    document.querySelectorAll('.gallery__thumb').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
  });
});
if (window.track) window.track('view_product', { id: '${p.id}', slug: '${p.slug}', price: ${p.price} });
</script>`,
  }));
}
