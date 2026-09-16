// =============================================
// AVEREST — app.js
// Общий клиентский скрипт: аналитика-заглушка + делегированный клик-трекинг
// (работает на всех страницах) и тизер "Новые поступления" на главной.
// =============================================

// ---------- Аналитика ----------
// Реальный вендор (GA4/Яндекс.Метрика) не подключен — событие уходит в
// dataLayer (GA4-совместимый формат) и в консоль, чтобы разработка событий
// не блокировалась ожиданием реальных счётчиков. Когда добавите GA4/Метрику
// на сайт, эти события начнут доходить до них без изменений в коде.
window.dataLayer = window.dataLayer || [];
window.track = function track(name, params) {
  window.dataLayer.push({ event: name, ...params });
  if (window.ym && window.YM_COUNTER_ID) {
    try { window.ym(window.YM_COUNTER_ID, 'reachGoal', name, params); } catch {}
  }
  console.debug('[track]', name, params || {});
};

document.addEventListener('click', function(e) {
  const el = e.target.closest('[data-track]');
  if (!el) return;
  let params = {};
  const raw = el.getAttribute('data-track-params');
  if (raw) { try { params = JSON.parse(raw); } catch {} }
  // Одна кнопка может значить сразу два события (например "Забронировать" —
  // это и click_telegram, и click_buy) — через запятую в data-track.
  el.getAttribute('data-track').split(',').forEach(function(name) {
    window.track(name.trim(), params);
  });
});

// ---------- Хелперы рендера карточки товара ----------
function formatPrice(n) {
  return Number(n).toLocaleString('ru-RU') + ' ₽';
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHttpsUrl(s) {
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
}

const STATUS_LABELS = {
  available: { emoji: '🟢', label: 'В наличии' },
  reserved: { emoji: '🟡', label: 'Забронировано' },
  sold: { emoji: '⚫', label: 'Продано' },
};

// Держим в паре с api/_lib/render.js — тот же стандарт словесной шкалы.
const CONDITION_LABELS = {
  new: { emoji: '🆕', label: 'Новое' },
  like_new: { emoji: '✨', label: 'Как новое' },
  very_good: { emoji: '👍', label: 'Очень хорошее' },
  good: { emoji: '✔', label: 'Хорошее' },
  worn: { emoji: '〰', label: 'Есть заметные следы носки' },
};

const NEW_ARRIVAL_DAYS = 7;
function isNewArrival(createdAt) {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs <= NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000;
}

function productCardHtml(p) {
  const status = STATUS_LABELS[p.status] || STATUS_LABELS.available;
  const condition = CONDITION_LABELS[p.condition] || (p.condition ? { emoji: '', label: p.condition } : null);
  const safePhotos = (p.photos || []).filter(isHttpsUrl);
  const photo = safePhotos[0] || 'https://placehold.co/400x500/111/c8a96e?text=AVEREST';
  const name = escapeHtml(p.name);
  const brandLine = p.brand ? '<p class="product-card__brand">' + escapeHtml(p.brand) + '</p>' : '';
  const newBadge = isNewArrival(p.createdAt) ? '<span class="product-card__badge product-card__badge--new">Новинка</span>' : '';
  const conditionText = condition ? ' · ' + condition.emoji + ' ' + escapeHtml(condition.label) : '';

  return (
    '<a href="/catalog/' + encodeURIComponent(p.slug) + '" class="product-card" data-track="click_product" data-track-params=\'{"id":"' + p.id + '"}\'>' +
      '<div class="product-card__img-wrap">' +
        '<img src="' + escapeHtml(photo) + '" alt="' + name + '" class="product-card__img" loading="lazy" decoding="async"/>' +
        newBadge +
        '<span class="product-card__badge status-badge status-badge--' + p.status + '">' + status.emoji + ' ' + status.label + '</span>' +
      '</div>' +
      '<div class="product-card__body">' +
        brandLine +
        '<h3 class="product-card__title">' + name + '</h3>' +
        '<p class="product-card__desc">Размер ' + escapeHtml(p.size) + conditionText + '</p>' +
        '<div class="product-card__footer">' +
          '<span class="product-card__price">' + formatPrice(p.price) + '</span>' +
          '<span class="btn btn--sm">Подробнее</span>' +
        '</div>' +
      '</div>' +
    '</a>'
  );
}

// ---------- Главная: тизер "Новые поступления" ----------
async function loadNewArrivals() {
  const container = document.getElementById('newArrivals');
  if (!container) return;

  try {
    const res = await fetch('/api/products');
    const all = await res.json();
    const visible = all.filter(function(p) { return p.status !== 'sold'; }).slice(0, 8);

    container.innerHTML = visible.length
      ? visible.map(productCardHtml).join('')
      : '<p class="catalog__status">Пока нет товаров — загляните в каталог позже.</p>';
  } catch {
    container.innerHTML = '<p class="catalog__status">Не удалось загрузить товары. <a href="/catalog">Открыть каталог →</a></p>';
  }
}

loadNewArrivals();
