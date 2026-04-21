import { NextResponse } from 'next/server';
import { getAnnualPositions } from '@/lib/tax';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = Number(searchParams.get('userId') || 1);
        const year = Number(searchParams.get('year') || new Date().getFullYear());

        const positions = await getAnnualPositions(userId, year);

        return NextResponse.json(positions);
    } catch (error) {
        console.error('Error in /api/taxes/annual:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
