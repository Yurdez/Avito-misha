// =============================================
// SecondStyle — app.js
// =============================================

// ---------- Текущий товар для заказа ----------
let currentItem = { name: '', price: '' };

// ---------- Открыть модальное окно ----------
function openOrder(itemName, itemPrice) {
  currentItem = { name: itemName, price: itemPrice };
  document.getElementById('modalItemName').textContent =
    itemName + ' — ' + itemPrice;
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modalSuccess').style.display = 'none';
  document.getElementById('orderForm').style.display = '';
  document.body.style.overflow = 'hidden';
}

// ---------- Закрыть модальное окно ----------
function closeOrder() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('orderForm').reset();
}

// Закрыть по Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeOrder();
});

// ---------- Отправить заказ ----------
async function sendOrder(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch('/api/send-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemName: currentItem.name,
        itemPrice: currentItem.price,
        name: data.name,
        phone: data.phone,
        email: data.email,
        delivery: data.delivery,
        address: data.address,
        comment: data.comment,
      })
    });

    if (res.ok) {
      form.style.display = 'none';
      document.getElementById('modalSuccess').style.display = '';
    } else {
      alert('Ошибка отправки. Попробуйте снова или напишите нам напрямую.');
    }
  } catch (err) {
    alert('Ошибка соединения. Напишите нам в Telegram напрямую.');
  }
}

// ---------- Каталог: загрузка и рендер товаров ----------
let allProducts = [];
let activeFilter = 'all';

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

function productCardHtml(p) {
  const badgeClass = p.condition === 'Отличное' ? 'product-card__badge product-card__badge--new' : 'product-card__badge';
  const safePhotos = (p.photos || []).filter(isHttpsUrl);
  const dots = safePhotos.length > 1
    ? '<div class="product-card__dots">' + safePhotos.map(function(_, i) {
        return '<button type="button" class="product-card__dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" aria-label="Фото ' + (i + 1) + '"></button>';
      }).join('') + '</div>'
    : '';

  const descParts = [];
  if (p.size) descParts.push('Размер ' + p.size);
  if (p.color) descParts.push(p.color.toLowerCase());
  let desc = descParts.join(', ');
  if (p.description) desc += (desc ? '. ' : '') + p.description;

  const name = escapeHtml(p.name);
  const condition = escapeHtml(p.condition);
  const photoUrl = escapeHtml(safePhotos[0] || 'https://placehold.co/400x500/111/c8a96e?text=AVEREST');
  const photosJson = escapeHtml(JSON.stringify(safePhotos));
  const price = formatPrice(p.price);

  return (
    '<div class="product-card" data-category="' + escapeHtml(p.category) + '">' +
      '<div class="product-card__img-wrap">' +
        '<img src="' + photoUrl + '" alt="' + name + '" class="product-card__img" data-photos=\'' + photosJson + '\'/>' +
        '<span class="' + badgeClass + '">' + condition + '</span>' +
        dots +
      '</div>' +
      '<div class="product-card__body">' +
        '<h3 class="product-card__title">' + name + '</h3>' +
        '<p class="product-card__desc">' + escapeHtml(desc) + '</p>' +
        '<div class="product-card__footer">' +
          '<span class="product-card__price">' + price + '</span>' +
          '<button class="btn btn--sm" data-order-name="' + name + '" data-order-price="' + price + '">Заказать</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderProducts() {
  const container = document.getElementById('products');
  const visible = activeFilter === 'all' ? allProducts : allProducts.filter(function(p) { return p.category === activeFilter; });

  if (visible.length === 0) {
    container.innerHTML = '<p class="catalog__status">' + (allProducts.length === 0 ? 'Пока нет товаров — скоро появятся.' : 'В этой категории пока пусто.') + '</p>';
    return;
  }

  container.innerHTML = visible.map(productCardHtml).join('');

  container.querySelectorAll('[data-order-name]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openOrder(btn.getAttribute('data-order-name'), btn.getAttribute('data-order-price'));
    });
  });

  container.querySelectorAll('.product-card__dot').forEach(function(dot) {
    dot.addEventListener('click', function() {
      const wrap = dot.closest('.product-card__img-wrap');
      const img = wrap.querySelector('.product-card__img');
      const photos = JSON.parse(img.getAttribute('data-photos'));
      const idx = parseInt(dot.getAttribute('data-idx'), 10);
      img.src = photos[idx];
      wrap.querySelectorAll('.product-card__dot').forEach(function(d) { d.classList.remove('active'); });
      dot.classList.add('active');
    });
  });
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
  } catch {
    allProducts = [];
  }
  renderProducts();
}

const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    filterBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activeFilter = btn.getAttribute('data-filter');
    renderProducts();
  });
});

if (document.getElementById('products')) {
  loadProducts();
}
