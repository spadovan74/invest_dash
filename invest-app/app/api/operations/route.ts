import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, symbol, quantity, price, brokerage = 0, otherFees = 0, date, userId } = body;

    // Resolve Asset
    let asset = await prisma.asset.findUnique({
      where: { symbol },
    });

    if (!asset) {
      asset = await prisma.asset.create({
        data: { symbol, name: symbol }, // Default name to symbol if new
      });
    }

    // Calculate Total based on Type
    // Buy: Price * Qtd + Fees
    // Sell: Price * Qtd - Fees (Net Value)
    // For storage, we might just store the raw values and calculate logic on read
    // But user asked for "Total Operação" and "Valor Líquido". 
    // Let's store "total" as the Financial Volume of the transaction (+ for inflow, - for outflow potentially, or just raw volume)
    // Convention: Total = (Quantity * Price). Net Value will be calculated on Read.
    // Or we can store "total" as the final Net Value. 
    // Let's stick to storing Components and calculating Net on the fly to avoid ambiguity.
    // However, schema has `total` field. Let's make it the "Total da Operação" (Gross)
    const totalOp = quantity * price;

    // Validation: Check Balance for SELL
    if (type === 'SELL') {
      // We need to import getStockBalance. Since it's in @/lib/portfolio, we can import it.
      // Note: Assuming 'symbol' is resolved to uppercase always.
      const { getStockBalance } = await import('@/lib/portfolio');
      const currentBalance = await getStockBalance(userId || 1, symbol);

      if (quantity > currentBalance) {
        return NextResponse.json({ error: `Saldo insuficiente. Você possui ${currentBalance} ações de ${symbol}.` }, { status: 400 });
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        type,
        quantity,
        price,
        brokerage,
        otherFees,
        total: totalOp,
        date: new Date(date),
        userId: userId || 1,
        assetId: asset.id,
      },
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error("Operation error", error);
    return NextResponse.json({ error: 'Failed to register operation' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Return all transactions for user
  const { searchParams } = new URL(request.url);
  const userId = Number(searchParams.get('userId') || 1);

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { asset: true },
    orderBy: { date: 'asc' }, // Order by date ASC to calculate portfolio correctly
  });

  return NextResponse.json({ transactions });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, price, quantity, brokerage, otherFees, date, type } = body;

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    let totalOp;
    if (quantity && price) {
      totalOp = quantity * price;
    }

    const updateData: any = {
      brokerage: Number(brokerage),
      otherFees: Number(otherFees),
      date: new Date(date),
    };

    if (price) updateData.price = Number(price);
    if (quantity) updateData.quantity = Number(quantity);
    if (type) updateData.type = type;
    if (totalOp) updateData.total = totalOp;

    const transaction = await prisma.transaction.update({
      where: { id: Number(id) },
      data: updateData
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error("Update error", error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}
