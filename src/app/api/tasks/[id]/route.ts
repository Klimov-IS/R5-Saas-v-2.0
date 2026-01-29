/**
 * Manager Task by ID API
 * PATCH /api/tasks/[id] - Update a task
 * DELETE /api/tasks/[id] - Delete a task
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyApiKey,
  getManagerTaskById,
  updateManagerTask,
  deleteManagerTask,
  type TaskStatus,
  type TaskPriority,
} from '@/db/helpers';

/**
 * PATCH /api/tasks/[id]
 * Update a task
 *
 * Body (all fields optional):
 * {
 *   status?: 'pending' | 'in_progress' | 'completed' | 'cancelled',
 *   priority?: 'low' | 'normal' | 'high' | 'urgent',
 *   title?: string,
 *   description?: string,
 *   notes?: string,
 *   due_date?: string (ISO date),
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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

    // Check if task exists and belongs to user
    const existingTask = await getManagerTaskById(id);
    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (existingTask.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Task belongs to another user' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const updates: any = {};

    if (body.status !== undefined) updates.status = body.status as TaskStatus;
    if (body.priority !== undefined) updates.priority = body.priority as TaskPriority;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.due_date !== undefined) updates.due_date = body.due_date;

    // Update task
    const updatedTask = await updateManagerTask(id, updates);

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error: any) {
    console.error('[API /api/tasks/[id] PATCH] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update task' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]
 * Delete a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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

    // Check if task exists and belongs to user
    const existingTask = await getManagerTaskById(id);
    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (existingTask.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Task belongs to another user' },
        { status: 403 }
      );
    }

    // Delete task
    const deleted = await deleteManagerTask(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete task' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error: any) {
    console.error('[API /api/tasks/[id] DELETE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete task' },
      { status: 500 }
    );
  }
}
