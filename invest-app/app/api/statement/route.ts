
import { NextRequest, NextResponse } from 'next/server';
import { getStatement } from '@/lib/portfolio';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
        // Fallback or Error
        // Ideally use session. For now fallback to 1 as per project convention so far
        return NextResponse.json(await getStatement(1));
    }

    try {
        const data = await getStatement(Number(userId));
        return NextResponse.json(data);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch statement' }, { status: 500 });
    }
}
