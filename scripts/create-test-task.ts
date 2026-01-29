/**
 * Create test task with proper UTF-8 encoding
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

async function createTestTask() {
  const apiKey = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
  const baseUrl = 'http://localhost:9002';

  const taskData = {
    store_id: 'TwKRrPji2KhTS8TmYJlD',
    entity_type: 'review',
    entity_id: 'uJY72y6zC1voi21wDOqP',
    action: 'generate_complaint',
    title: 'Сгенерировать жалобу на отзыв',
    description: 'Отзыв 5 звезд от пользователя Виктория',
    priority: 'high',
    due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
  };

  try {
    const response = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(taskData),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Task created successfully!');
      console.log('Task ID:', result.task.id);
      console.log('Title:', result.task.title);
      console.log('Description:', result.task.description);
      console.log('Priority:', result.task.priority);
      console.log('Due date:', result.task.due_date);
    } else {
      console.error('❌ Failed to create task:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTestTask();
