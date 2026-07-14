// Переиспользуемое соединение с Redis между вызовами тёплой serverless-функции.

import { createClient } from 'redis';

let client;

export default async function getRedis() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis error', err));
  }
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}
