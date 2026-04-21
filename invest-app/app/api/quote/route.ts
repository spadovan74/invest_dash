import { NextResponse } from 'next/server';
import { getStockPrice } from '@/lib/market';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }

    const data = await getStockPrice(symbol);

    if (data) {
        return NextResponse.json(data);
    } else {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
}
