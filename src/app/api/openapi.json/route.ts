
import { NextResponse } from 'next/server';
import swaggerSpec from '@/lib/swagger';

export async function GET() {
  try {
    return NextResponse.json(swaggerSpec);
  } catch (error) {
    console.error("Failed to generate OpenAPI spec:", error);
    return NextResponse.json(
      { error: "Failed to generate OpenAPI spec" },
      { status: 500 }
    );
  }
}
