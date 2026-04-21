import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWatchlistQuotes } from '@/lib/market';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = Number(searchParams.get('userId') || 1);

        const items = await prisma.watchlist.findMany({
            where: { userId },
            orderBy: { symbol: 'asc' }
        });

        // Fetch quotes
        const symbols = items.map(item => item.symbol);
        const quotes = await getWatchlistQuotes(symbols);

        const dataWithQuotes = items.map(item => {
            const qt = quotes[item.symbol.toUpperCase()];
            return {
                id: item.id,
                symbol: item.symbol,
                target: item.target,
                createdAt: item.createdAt,
                quote: qt || null
            };
        });

        return NextResponse.json(dataWithQuotes);
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = Number(searchParams.get('userId') || 1);

        const { symbol, target } = await request.json();

        if (!symbol || target === undefined) {
            return NextResponse.json({ error: 'Symbol and target are required' }, { status: 400 });
        }

        // Add or update
        const item = await prisma.watchlist.upsert({
            where: {
                userId_symbol: {
                    userId: userId,
                    symbol: symbol.toUpperCase()
                }
            },
            update: {
                target: parseFloat(target)
            },
            create: {
                userId: userId,
                symbol: symbol.toUpperCase(),
                target: parseFloat(target)
            }
        });

        return NextResponse.json(item);

    } catch (error) {
        console.error('Error adding to watchlist:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = Number(searchParams.get('userId') || 1);

        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Id is required' }, { status: 400 });
        }

        await prisma.watchlist.deleteMany({
            where: {
                id: parseInt(id),
                userId: userId // Ensure it belongs to the user
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting from watchlist:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
