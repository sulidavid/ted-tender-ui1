import { NextRequest, NextResponse } from 'next/server';
import { parseSearchParams, searchTenders } from '@/lib/ted';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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
