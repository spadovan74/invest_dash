import { NextRequest, NextResponse } from 'next/server';
import { getStockHistory } from '@/lib/market';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const range = searchParams.get('range') || '1mo';
    const interval = searchParams.get('interval') || '1d';

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }

    try {
        const data = await getStockHistory(symbol, range, interval);
        return NextResponse.json(data);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
