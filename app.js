// =============================================
// SecondStyle — app.js
// =============================================

const TELEGRAM_BOT_TOKEN = '8806045240:AAGBqoiGIZ3LoYX2ggAYpKHKxBRJ0ANcseI';
const TELEGRAM_CHAT_ID   = '195600304';

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

  const message =
    '🛍 *Новый заказ с сайта!*

' +
    '*Товар:* ' + currentItem.name + '
' +
    '*Цена:* ' + currentItem.price + '

' +
    '*Покупатель:*
' +
    '👤 ' + data.name + '
' +
    '📞 ' + data.phone + '
' +
    (data.email ? '📧 ' + data.email + '
' : '') +
    '
*Доставка:* ' + data.delivery + '
' +
    (data.address ? '📍 ' + data.address + '
' : '') +
    (data.comment ? '
💬 ' + data.comment : '');

  try {
    const res = await fetch(
      'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        })
      }
    );

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

// ---------- Фильтры каталога ----------
const filterBtns = document.querySelectorAll('.filter-btn');
const productCards = document.querySelectorAll('.product-card');

filterBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    filterBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');

    const filter = btn.getAttribute('data-filter');
    productCards.forEach(function(card) {
      if (filter === 'all' || card.getAttribute('data-category') === filter) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  });
});
