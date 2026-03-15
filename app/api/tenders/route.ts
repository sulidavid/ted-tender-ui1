import { NextRequest, NextResponse } from 'next/server';
import { parseSearchParams, searchTenders } from '@/lib/ted';

export const dynamic = 'force-dynamic';

const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_PER_WINDOW = 5;

type Bucket = { count: number; windowStart: number };

const ipBuckets = new Map<string, Bucket>();

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const now = Date.now();
    let bucket = ipBuckets.get(ip);

    if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
      bucket = { count: 1, windowStart: now };
      ipBuckets.set(ip, bucket);
    } else if (bucket.count >= RATE_LIMIT_PER_WINDOW) {
      const waitMs = RATE_WINDOW_MS - (now - bucket.windowStart);
      const waitMin = Math.max(1, Math.ceil(waitMs / 60_000));
      return NextResponse.json(
        {
          error: `Too many searches. Please try again in about ${waitMin} minute(s).`
        },
        { status: 429 }
      );
    } else {
      bucket.count += 1;
      ipBuckets.set(ip, bucket);
    }

    const params = parseSearchParams({
      keyword: request.nextUrl.searchParams.get('keyword') ?? '',
      dateFrom: request.nextUrl.searchParams.get('dateFrom') ?? '',
      dateTo: request.nextUrl.searchParams.get('dateTo') ?? '',
      buyerCountry: request.nextUrl.searchParams.get('buyerCountry') ?? '',
      contractNature: request.nextUrl.searchParams.get('contractNature') ?? 'all',
      page: request.nextUrl.searchParams.get('page') ?? '1',
      limit: request.nextUrl.searchParams.get('limit') ?? '10',
      scope: request.nextUrl.searchParams.get('scope') ?? 'ACTIVE'
    });

    const result = await searchTenders(params);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
