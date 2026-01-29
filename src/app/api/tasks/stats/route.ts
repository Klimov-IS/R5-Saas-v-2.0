/**
 * Manager Tasks Statistics API
 * GET /api/tasks/stats - Get task statistics for KPI cards
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, getManagerTaskStats } from '@/db/helpers';

/**
 * GET /api/tasks/stats
 * Get task statistics for the current user
 *
 * Response:
 * {
 *   totalTasks: number,
 *   pendingTasks: number,
 *   inProgressTasks: number,
 *   overdueTasks: number,
 *   complaintsTasks: number,
 *   chatsTasks: number
 * }
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

    // Get statistics
    const stats = await getManagerTaskStats(userId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('[API /api/tasks/stats GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task statistics' },
      { status: 500 }
    );
  }
}
