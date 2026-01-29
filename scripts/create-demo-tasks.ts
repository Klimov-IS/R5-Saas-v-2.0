/**
 * Create demo tasks for Task Management Center
 */

import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const API_KEY = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
const BASE_URL = 'http://localhost:9002';

async function createTask(data: any) {
  const response = await fetch(`${BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

async function main() {
  console.log('Creating demo tasks...\n');

  // Get real review and chat IDs
  const reviewsRes = await fetch(`${BASE_URL}/api/stores/TwKRrPji2KhTS8TmYJlD/reviews?limit=3`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  const reviews = await reviewsRes.json();

  const chatsRes = await fetch(`${BASE_URL}/api/stores/TwKRrPji2KhTS8TmYJlD/chats?limit=2`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  const chats = await chatsRes.json();

  if (!reviews.data || reviews.data.length === 0) {
    console.error('No reviews found!');
    return;
  }

  if (!chats.data || chats.data.length === 0) {
    console.error('No chats found!');
    return;
  }

  const tasks = [
    {
      store_id: 'TwKRrPji2KhTS8TmYJlD',
      entity_type: 'review',
      entity_id: reviews.data[0].id,
      action: 'check_complaint',
      title: 'Проверить статус жалобы на WB',
      description: `Отзыв от ${reviews.data[0].author || 'покупателя'}`,
      priority: 'normal',
      due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      store_id: 'TwKRrPji2KhTS8TmYJlD',
      entity_type: 'chat',
      entity_id: chats.data[0].id,
      action: 'reply_to_chat',
      title: 'Ответить клиенту в диалоге',
      description: `Диалог с ${chats.data[0].client_name || 'покупателем'}`,
      priority: 'urgent',
      due_date: new Date(Date.now() + 0.5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      store_id: 'TwKRrPji2KhTS8TmYJlD',
      entity_type: 'review',
      entity_id: reviews.data[1]?.id || reviews.data[0].id,
      action: 'submit_complaint',
      title: 'Подать жалобу на негативный отзыв',
      description: 'Отзыв содержит недостоверную информацию',
      priority: 'high',
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      store_id: 'TwKRrPji2KhTS8TmYJlD',
      entity_type: 'chat',
      entity_id: chats.data[1]?.id || chats.data[0].id,
      action: 'reply_to_chat',
      title: 'Ответить на вопрос о товаре',
      description: 'Клиент спрашивает про наличие размера',
      priority: 'normal',
      due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const taskData of tasks) {
    try {
      const result = await createTask(taskData);
      if (result.success) {
        console.log(`✅ ${taskData.title}`);
        console.log(`   ID: ${result.task.id}`);
        console.log(`   Priority: ${result.task.priority}`);
        console.log('');
      } else {
        console.error(`❌ ${taskData.title}`);
        console.error(`   Error: ${result.error}`);
        console.log('');
      }
    } catch (error: any) {
      console.error(`❌ ${taskData.title}`);
      console.error(`   Error: ${error.message}`);
      console.log('');
    }
  }

  console.log('Done!');
}

main();
