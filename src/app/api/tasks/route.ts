/**
 * Manager Tasks API
 * Endpoints for Task Management Center
 *
 * GET /api/tasks - Get tasks list with filters
 * POST /api/tasks - Create a new task
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/db/helpers';
import {
  getManagerTasks,
  createManagerTask,
  type TaskStatus,
  type TaskEntityType,
  type TaskAction,
} from '@/db/helpers';

/**
 * GET /api/tasks
 * Get tasks for the current user with optional filters
 *
 * Query params:
 * - storeId: Filter by store
 * - status: pending | in_progress | completed | cancelled
 * - entityType: review | chat | question
 * - action: generate_complaint | submit_complaint | check_complaint | reply_to_chat | reply_to_question
 * - limit: Number of tasks to return
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }

    const settings = await verifyApiKey(apiKey);
    if (!settings) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const userId = settings.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const status = searchParams.get('status') as TaskStatus | undefined;
    const entityType = searchParams.get('entityType') as TaskEntityType | undefined;
    const action = searchParams.get('action') as TaskAction | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Get tasks
    const tasks = await getManagerTasks(userId, {
      storeId,
      status,
      entityType,
      action,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error: any) {
    console.error('[API /api/tasks GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Create a new task
 *
 * Body:
 * {
 *   store_id: string,
 *   entity_type: 'review' | 'chat' | 'question',
 *   entity_id: string,
 *   action: 'generate_complaint' | 'submit_complaint' | 'check_complaint' | 'reply_to_chat' | 'reply_to_question',
 *   title: string,
 *   description?: string,
 *   priority?: 'low' | 'normal' | 'high' | 'urgent',
 *   due_date?: string (ISO date),
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }

    const settings = await verifyApiKey(apiKey);
    if (!settings) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const userId = settings.id;

    // Parse request body
    const body = await request.json();
    const {
      store_id,
      entity_type,
      entity_id,
      action,
      title,
      description,
      priority = 'normal',
      due_date,
    } = body;

    // Validate required fields
    if (!store_id || !entity_type || !entity_id || !action || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: store_id, entity_type, entity_id, action, title' },
        { status: 400 }
      );
    }

    // Create task
    const task = await createManagerTask({
      user_id: userId,
      store_id,
      entity_type,
      entity_id,
      action,
      title,
      description: description || null,
      priority,
      status: 'pending',
      due_date: due_date || null,
      notes: null,
    });

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error: any) {
    console.error('[API /api/tasks POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    );
  }
}
