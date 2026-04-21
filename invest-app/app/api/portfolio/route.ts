import { NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/portfolio';

// Avoid caching dynamic data
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 1);

    try {
        const portfolio = await getPortfolio(userId);
        return NextResponse.json(portfolio);
    } catch (e) {
        console.error("Portfolio error", e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
