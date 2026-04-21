import { NextResponse } from 'next/server';
import { getMonthlyTaxReports } from '@/lib/tax';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = Number(searchParams.get('userId') || 1);

        const reports = await getMonthlyTaxReports(userId);

        return NextResponse.json(reports);
    } catch (error) {
        console.error('Error in /api/taxes/monthly:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
