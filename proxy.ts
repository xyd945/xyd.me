import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function proxy(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';

  try {
    const limited = await rateLimit(ip);
    if (limited) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Error in rate limiting middleware:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export const config = {
  matcher: '/api/chat',
};
