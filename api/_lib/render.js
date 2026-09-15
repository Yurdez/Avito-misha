// Общий слой рендера для серверных HTML-страниц (каталог, товар, sitemap).
// Держит те же классы, что и style.css/index.html, чтобы SSR-страницы не
// выбивались из общего дизайна статических страниц.

export const SITE_URL = process.env.SITE_URL || 'https://avito-misha.vercel.app';
export const TELEGRAM_USERNAME = 'brendyshmendy_bot';

export const CATEGORIES = {
  jacket: 'Куртки',
  jeans: 'Джинсы',
  pants: 'Брюки',
  tshirt: 'Футболки',
  hoodie: 'Худи',
  sweatshirt: 'Свитшоты',
  shoes: 'Обувь',
  dress: 'Платья',
  accessories: 'Аксессуары',
};

export const CATEGORY_ORDER = Object.keys(CATEGORIES);

export const STATUS = {
  available: { label: 'В наличии', emoji: '🟢', schema: 'https://schema.org/InStock' },
  reserved: { label: 'Забронировано', emoji: '🟡', schema: 'https://schema.org/LimitedAvailability' },
  sold: { label: 'Продано', emoji: '⚫', schema: 'https://schema.org/OutOfStock' },
};

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(s) {
  return escapeHtml(s);
}

const TRANSLIT = {
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'i',
  к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
  х:'h', ц:'c', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya',
};

export function slugify(text, suffix) {
  const transliterated = String(text || '')
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('');

  const base = transliterated
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  return (base || 'item') + (suffix ? '-' + suffix : '');
}

export function formatPrice(n) {
  return Number(n).toLocaleString('ru-RU') + ' ₽';
}

export function isHttpsUrl(s) {
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
}

export function telegramLink(text) {
  return `https://t.me/${TELEGRAM_USERNAME}?text=${encodeURIComponent(text)}`;
}

export function bookingMessage(p) {
  return `Здравствуйте! Хочу забронировать:\n\n${p.brand ? p.brand + ' ' : ''}${p.name}\nРазмер ${p.size}\nЦена ${formatPrice(p.price)}\nID ${p.id.slice(0, 8)}`;
}

export function questionMessage(p) {
  return `Здравствуйте! Есть вопрос про: ${p.brand ? p.brand + ' ' : ''}${p.name} (ID ${p.id.slice(0, 8)})`;
}

export function statusBadgeHtml(status) {
  const s = STATUS[status] || STATUS.available;
  return `<span class="status-badge status-badge--${status}">${s.emoji} ${escapeHtml(s.label)}</span>`;
}

export function breadcrumbsHtml(items) {
  const parts = items.map((it, i) => {
    if (it.href && i < items.length - 1) {
      return `<a href="${escapeAttr(it.href)}">${escapeHtml(it.label)}</a>`;
    }
    return `<span aria-current="page">${escapeHtml(it.label)}</span>`;
  });
  return `<nav class="breadcrumbs" aria-label="Хлебные крошки">${parts.join('<span class="breadcrumbs__sep">/</span>')}</nav>`;
}

export function breadcrumbsJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.label,
      item: it.href ? SITE_URL + it.href : undefined,
    })),
  };
}

export function productJsonLd(p, url) {
  const s = STATUS[p.status] || STATUS.available;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: (p.brand ? p.brand + ' ' : '') + p.name,
    image: p.photos || [],
    description: p.description || `${p.brand || ''} ${p.name}, размер ${p.size}`.trim(),
    sku: p.id,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    itemCondition: 'https://schema.org/UsedCondition',
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'RUB',
      price: p.price,
      availability: s.schema,
      itemCondition: 'https://schema.org/UsedCondition',
    },
  };
}

export function jsonLdScript(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function headerHtml(active) {
  const link = (href, label, key) =>
    `<a href="${href}" class="nav__link${active === key ? ' active' : ''}">${label}</a>`;
  return `
<header class="header">
  <div class="container header__inner">
    <a href="/" class="logo">AVER<span>EST</span></a>
    <nav class="nav">
      ${link('/', 'Главная', 'home')}
      ${link('/catalog', 'Каталог', 'catalog')}
      ${link('/contacts.html', 'Контакты', 'contacts')}
    </nav>
    <a href="${telegramLink('Здравствуйте! Подскажите, пожалуйста...')}" target="_blank" rel="noopener" class="btn btn--sm" data-track="click_telegram" data-track-params='{"place":"header"}'>Telegram</a>
  </div>
</header>`;
}

function footerHtml() {
  return `
<footer class="footer">
  <div class="container footer__inner">
    <div class="footer__brand">
      <a href="/" class="logo">AVER<span>EST</span></a>
      <p>Брендовый секонд-хенд с доставкой по России</p>
    </div>
    <div class="footer__links">
      <a href="/">Главная</a>
      <a href="/catalog">Каталог</a>
      <a href="/contacts.html">Контакты</a>
    </div>
    <div class="footer__contacts">
      <a href="${telegramLink('Здравствуйте! Подскажите, пожалуйста...')}" target="_blank" rel="noopener" data-track="click_telegram" data-track-params='{"place":"footer"}'>Telegram</a>
      <a href="https://www.avito.ru/" target="_blank" rel="noopener">Авито</a>
    </div>
  </div>
  <div class="footer__bottom">
    <div class="container"><p>© 2025 AVEREST. Все права защищены.</p></div>
  </div>
</footer>`;
}

const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>`;

export function pageShell({ title, description, canonical, ogImage, bodyHtml, activeNav, jsonLd = [], extraHead = '', extraScripts = '' }) {
  const canonicalUrl = SITE_URL + canonical;
  const image = ogImage || 'https://placehold.co/1200x630/111/c8a96e?text=AVEREST';
  const ld = jsonLd.map(jsonLdScript).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}"/>
  <link rel="canonical" href="${canonicalUrl}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${escapeAttr(title)}"/>
  <meta property="og:description" content="${escapeAttr(description)}"/>
  <meta property="og:url" content="${canonicalUrl}"/>
  <meta property="og:image" content="${escapeAttr(image)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeAttr(title)}"/>
  <meta name="twitter:description" content="${escapeAttr(description)}"/>
  <meta name="twitter:image" content="${escapeAttr(image)}"/>
  <link rel="stylesheet" href="/style.css"/>
  ${FONT_LINKS}
  ${ld}
  ${extraHead}
</head>
<body>
${headerHtml(activeNav)}
${bodyHtml}
${footerHtml()}
<script src="/app.js"></script>
${extraScripts}
</body>
</html>`;
}

export function productCardHtml(p) {
  const safePhotos = (p.photos || []).filter(isHttpsUrl);
  const photo = safePhotos[0] || 'https://placehold.co/400x500/111/c8a96e?text=AVEREST';
  const status = STATUS[p.status] || STATUS.available;
  const brandLine = p.brand ? `<p class="product-card__brand">${escapeHtml(p.brand)}</p>` : '';
  return `<a href="/catalog/${escapeAttr(p.slug)}" class="product-card" data-track="click_product" data-track-params='{"id":"${p.id}"}'>
    <div class="product-card__img-wrap">
      <img src="${escapeAttr(photo)}" alt="${escapeAttr((p.brand ? p.brand + ' ' : '') + p.name)}" class="product-card__img" loading="lazy" decoding="async"/>
      <span class="product-card__badge status-badge status-badge--${p.status}">${status.emoji} ${escapeHtml(status.label)}</span>
    </div>
    <div class="product-card__body">
      ${brandLine}
      <h3 class="product-card__title">${escapeHtml(p.name)}</h3>
      <p class="product-card__desc">Размер ${escapeHtml(p.size)}${p.condition ? ' · ' + escapeHtml(p.condition) : ''}</p>
      <div class="product-card__footer">
        <span class="product-card__price">${formatPrice(p.price)}</span>
        <span class="btn btn--sm">Подробнее</span>
      </div>
    </div>
  </a>`;
}

export { headerHtml, footerHtml };
