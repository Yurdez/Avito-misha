# SecondStyle — сайт-витрина б/у вещей

Сайт для продажи брендовых б/у вещей параллельно с Авито.

## Файлы

- **index.html** — главная страница с каталогом и формой заказа
- **contacts.html** — страница контактов с формой обратной связи
- **style.css** — все стили сайта
- **app.js** — логика фильтров, модального окна, отправки заказов

## Настройка Telegram-бота (обязательно!)

### 1. Создайте бота

1. Напишите [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду /newbot
3. Задайте имя и username боту
4. Скопируйте **токен** (вида 123456789:ABCdef...)

### 2. Получите Chat ID

1. Напишите вашему боту любое сообщение
2. Откройте в браузере: https://api.telegram.org/botВАШ_ТОКЕН/getUpdates
3. Найдите поле "chat": {"id": XXXXXXXX} — это ваш Chat ID

### 3. Вставьте данные в файлы

В файлах **app.js** и **contacts.html** замените:
- YOUR_BOT_TOKEN — на токен вашего бота
- YOUR_CHAT_ID — на ваш Chat ID
- YOUR_TELEGRAM — на ваш username в Telegram
- +7XXXXXXXXXX — на ваш номер телефона
- your@email.ru — на вашу почту

## Добавление товаров

В файле **index.html** найдите блок с классом products и добавляйте карточки по шаблону:

```html
<div class="product-card" data-category="КАТЕГОРИЯ">
  <div class="product-card__img-wrap">
    <img src="images/ФОТО.jpg" alt="Название"/>
    <span class="product-card__badge">Состояние</span>
  </div>
  <div class="product-card__body">
    <h3 class="product-card__title">Название товара</h3>
    <p class="product-card__desc">Описание, размер, состояние</p>
    <div class="product-card__footer">
      <span class="product-card__price">Х ХХХ руб.</span>
      <button class="btn btn--sm" onclick="openOrder('Название','Цена')">Заказать</button>
    </div>
  </div>
</div>
```

**Категории:** jacket, jeans, shoes, dress, accessories

## Фотографии товаров

Создайте папку **images/** и кладите фото в неё.
Формат: item1.jpg, item2.jpg и т.д.

## Деплой сайта (хостинг)

### Вариант 1 — GitHub Pages (бесплатно)
1. Settings → Pages → Source: Deploy from a branch → main → Save
2. Сайт будет на: https://yurdez.github.io/Avito-misha

### Вариант 2 — Netlify (бесплатно)
1. Зайдите на netlify.com
2. Drag & Drop папку с файлами — сайт сразу онлайн

### Вариант 3 — Свой домен
Купите домен (например на reg.ru) и настройте хостинг.

## Структура проекта

```
Avito-misha/
├── index.html
├── contacts.html
├── style.css
├── app.js
├── images/
│   ├── item1.jpg
│   ├── item2.jpg
│   └── ...
└── README.md
```
