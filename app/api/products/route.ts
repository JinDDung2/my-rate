import { NextResponse } from 'next/server';
import { productsResponse } from '@/lib/products';

export function GET(request: Request) {
  const url = new URL(request.url);

  if (process.env.NODE_ENV !== 'production' && url.searchParams.get('forceError') === '1') {
    return NextResponse.json({ error: 'Forced products load failure' }, { status: 500 });
  }

  return NextResponse.json(productsResponse);
}
