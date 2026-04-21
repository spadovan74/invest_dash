import { getStockPrice } from './market';
import prisma from '@/lib/prisma';

export interface PortfolioItem {
    assetId: number;
    symbol: string;
    name: string;
    quantity: number;
    averagePrice: number; // PM
    totalCost: number; // Estoque * PM
    realizedProfit: number; // Lucro acumulado (fechado)
    currentPrice?: number; // Preço Atual de Mercado
}

export interface TaxReport {
    month: string; // "YYYY-MM"
    totalSales: number;
    swingSales: number;
    dtSales: number;
    taxableSwingSales: number; // Swing Trade > 20k
    irSwing: number;
    irDt: number;
    totalIr: number; // Soma
}

export interface PortfolioResult {
    positions: PortfolioItem[];
    taxReports: TaxReport[];
    totalEquity: number; // Valor Total Atual
}

export async function getPortfolio(userId: number): Promise<PortfolioResult> {
    const transactions = await prisma.transaction.findMany({
        where: { userId },
        include: { asset: true },
        orderBy: { date: 'asc' }, // Must process in chronological order
    });

    const positions: Record<string, PortfolioItem> = {};
    const monthlySales: Record<string, { sales: number; purchases: number; profit: number; swingSales: number; dtSales: number; swingProfit: number; dtProfit: number }> = {};

    // Helper to track todays buys: symbol -> quantity
    let todaysBuys: Record<string, number> = {};
    let currentProcessingDate = '';

    // Process transactions
    for (const tx of transactions) {
        const symbol = tx.asset.symbol;
        const date = new Date(tx.date);
        const dateStr = date.toISOString().slice(0, 10);
        const monthKey = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

        // Reset daily tracker if new day
        if (dateStr !== currentProcessingDate) {
            currentProcessingDate = dateStr;
            todaysBuys = {};
        }

        if (!positions[symbol]) {
            positions[symbol] = {
                assetId: tx.assetId,
                symbol: tx.asset.symbol,
                name: tx.asset.name || symbol,
                quantity: 0,
                averagePrice: 0,
                totalCost: 0,
                realizedProfit: 0,
            };
        }

        // Initialize monthly stats if missing
        if (!monthlySales[monthKey]) {
            monthlySales[monthKey] = {
                sales: 0,
                purchases: 0,
                profit: 0,
                swingSales: 0,
                dtSales: 0,
                swingProfit: 0,
                dtProfit: 0
            } as any;
        }

        const pos = positions[symbol];
        const fees = (tx.brokerage || 0) + (tx.otherFees || 0);

        let totalOp = tx.quantity * tx.price;
        let result = 0;

        if (tx.type === 'BUY') {
            const operationCost = totalOp + fees;
            const currentTotalCost = pos.quantity * pos.averagePrice;
            const newTotalCost = currentTotalCost + operationCost;
            const newQuantity = pos.quantity + tx.quantity;

            pos.averagePrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
            pos.quantity = newQuantity;
            pos.totalCost = newTotalCost;

            // Track for Day Trade
            if (!todaysBuys[symbol]) todaysBuys[symbol] = 0;
            todaysBuys[symbol] += tx.quantity;

        } else if (tx.type === 'SELL') {
            // Day Trade Logic
            const boughtToday = todaysBuys[symbol] || 0;
            let dtQuantity = 0;

            if (boughtToday > 0) {
                dtQuantity = Math.min(tx.quantity, boughtToday);
                todaysBuys[symbol] -= dtQuantity;
            }

            const saleValue = totalOp;
            const costOfSoldShares = tx.quantity * pos.averagePrice; // Note: avgPrice includes today's purchase if any
            const grossProfit = saleValue - costOfSoldShares;
            const netProfit = grossProfit - fees;

            pos.realizedProfit += netProfit;
            pos.quantity -= tx.quantity;
            pos.totalCost = pos.quantity * pos.averagePrice;

            // Split Profit for Tax
            const dtRatio = dtQuantity / tx.quantity;
            const dtProfit = netProfit * dtRatio;
            const stProfit = netProfit * (1 - dtRatio);

            const dtSaleValue = saleValue * dtRatio;
            const stSaleValue = saleValue * (1 - dtRatio);

            // Accumulate Monthly Stats
            const stats = monthlySales[monthKey] as any;
            stats.sales += saleValue;
            stats.profit += netProfit;
            stats.dtSales += dtSaleValue;
            stats.swingSales += stSaleValue;
            stats.dtProfit += dtProfit;
            stats.swingProfit += stProfit;

        } else if (tx.type === 'DIVIDEND') {
            pos.realizedProfit += tx.price;
        }
    }

    const positionsArray = Object.values(positions).filter(p => p.quantity > 0 || p.realizedProfit !== 0);

    // Fetch current prices for open positions
    await Promise.all(positionsArray.map(async (pos) => {
        if (pos.quantity > 0) {
            const quote = await getStockPrice(pos.symbol);
            if (quote) {
                pos.currentPrice = quote.price;
            } else {
                pos.currentPrice = pos.averagePrice;
            }
        }
    }));

    // Calculate Tax Reports
    const taxReports: TaxReport[] = Object.entries(monthlySales).map(([month, data]: [string, any]) => {
        // IR Logic
        let irSwing = 0;
        if (data.swingSales > 20000 && data.swingProfit > 0) {
            irSwing = data.swingProfit * 0.15;
        }

        let irDt = 0;
        if (data.dtProfit > 0) {
            irDt = data.dtProfit * 0.20;
        }

        return {
            month,
            totalSales: data.sales,
            swingSales: data.swingSales,
            dtSales: data.dtSales,
            taxableSwingSales: data.swingSales > 20000 ? data.swingSales : 0,
            irSwing: irSwing,
            irDt: irDt,
            totalIr: irSwing + irDt
        };
    });

    return {
        positions: positionsArray,
        taxReports: taxReports,
        totalEquity: 0
    };
}

export interface StatementItem {
    id: number;
    date: Date;
    symbol: string;
    type: string;
    quantity: number;
    price: number;
    cust: number; // Brokerage
    rat: number; // Total Costs (Brokerage + Fees)
    totalOp: number;
    netValue: number;
    stockBalance: number;
    avgPrice: number;
    result: number | null;
    gainPercent: number | null;
    monthRef: string;
    monthlySales: number;
    monthlyPurchases: number;
    monthlyProfit: number;
    irDue: number;
}

export async function getStatement(userId: number): Promise<StatementItem[]> {
    const transactions = await prisma.transaction.findMany({
        where: { userId },
        include: { asset: true },
        orderBy: { date: 'asc' },
    });

    // 0. Detect Day Trades first? Or do it in single pass?
    // Single pass needs to know if a sale matches a buy on same day.
    // We can pre-scan or just keep a "buysToday" map.

    const positions: Record<string, { quantity: number; avgPrice: number }> = {};
    const monthlyStats: Record<string, { sales: number; purchases: number; profit: number; swingSales: number; dtSales: number; swingProfit: number; dtProfit: number }> = {};
    const tempItems: any[] = [];

    // Helper to track todays buys: symbol -> quantity
    let todaysBuys: Record<string, number> = {};
    let currentProcessingDate = '';

    for (const tx of transactions) {
        const symbol = tx.asset.symbol;
        const date = new Date(tx.date);
        const dateStr = date.toISOString().slice(0, 10);
        const monthKey = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

        // Reset daily tracker if new day
        if (dateStr !== currentProcessingDate) {
            currentProcessingDate = dateStr;
            todaysBuys = {};
        }

        if (!positions[symbol]) {
            positions[symbol] = { quantity: 0, avgPrice: 0 };
        }

        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
                sales: 0,
                purchases: 0,
                profit: 0,
                swingSales: 0,
                dtSales: 0,
                swingProfit: 0,
                dtProfit: 0
            } as any;
        }

        const pos = positions[symbol];
        const brokerage = tx.brokerage || 0;
        const otherFees = tx.otherFees || 0;
        const fees = brokerage + otherFees;

        let totalOp = tx.quantity * tx.price;
        let netValue = 0;
        let result: number | null = null;
        let gainPercent: number | null = null;

        if (tx.type === 'BUY') {
            netValue = -(totalOp + fees);

            // Update average price with simplified logic (Standard B3 Average)
            const currentTotalCost = pos.quantity * pos.avgPrice;
            const operationCost = totalOp + fees;
            const newTotalCost = currentTotalCost + operationCost;
            const newQuantity = pos.quantity + tx.quantity;

            pos.avgPrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
            pos.quantity = newQuantity;

            monthlyStats[monthKey].purchases += totalOp;

            // Track for Day Trade
            if (!todaysBuys[symbol]) todaysBuys[symbol] = 0;
            todaysBuys[symbol] += tx.quantity;

        } else if (tx.type === 'SELL') {
            netValue = totalOp - fees;

            // Day Trade Logic
            // Check if we bought this symbol today
            const boughtToday = todaysBuys[symbol] || 0;
            let isDayTrade = false;
            let dtQuantity = 0;
            let stQuantity = tx.quantity;

            if (boughtToday > 0) {
                // We have a match!
                dtQuantity = Math.min(tx.quantity, boughtToday);
                stQuantity = tx.quantity - dtQuantity;
                isDayTrade = true;
                // Decrement used daily buys (FIFO for day trade matching?)
                // Simple logic: just reduce availability
                todaysBuys[symbol] -= dtQuantity;
            }

            // Profit Calculation
            // For mixed trade (part DT, part ST), we should ideally split.
            // But simple array item structure assumes 1 row.
            // User edits per row. Ideally user separates DT rows.
            // If automated:

            // Calculate Cost based on Average Price (Standard)
            const costOfSoldShares = tx.quantity * pos.avgPrice;
            const grossProfit = totalOp - costOfSoldShares;
            result = grossProfit - fees; // Net Profit Total

            // Split Profit for Tax Purposes (Proportional)
            // DT Profit portion?
            // Strictly DT profit is (SellPrice - BuyPriceToday) * Qty.
            // Our pos.avgPrice already includes today's buy! 
            // So result is approximately correct for the mixed batch.
            // We will apportion the result based on Qty for simple tax estimation.

            // Note: This is an approximation. Precise calculation requires matching specific buy lots.
            const dtRatio = dtQuantity / tx.quantity;
            const dtProfit = result * dtRatio;
            const stProfit = result * (1 - dtRatio);

            const dtSaleValue = totalOp * dtRatio;
            const stSaleValue = totalOp * (1 - dtRatio);

            if (costOfSoldShares > 0) {
                gainPercent = (result / costOfSoldShares) * 100;
            }

            pos.quantity -= tx.quantity;

            monthlyStats[monthKey].sales += totalOp;
            monthlyStats[monthKey].profit += result;

            // Tax Stats
            (monthlyStats[monthKey] as any).dtSales += dtSaleValue;
            (monthlyStats[monthKey] as any).swingSales += stSaleValue;
            (monthlyStats[monthKey] as any).dtProfit += dtProfit;
            (monthlyStats[monthKey] as any).swingProfit += stProfit;

        } else if (tx.type === 'DIVIDEND') {
            netValue = tx.price;
            totalOp = tx.price;
        }

        tempItems.push({
            id: tx.id,
            date: tx.date,
            symbol: symbol,
            type: tx.type,
            quantity: tx.quantity,
            price: tx.price,
            cust: brokerage,
            rat: fees, // Total: Brokerage + Other
            totalOp: totalOp,
            netValue: netValue,
            stockBalance: pos.quantity,
            avgPrice: pos.avgPrice,
            result: result,
            gainPercent: gainPercent,
            monthRef: monthKey
        });
    }

    // 2. Map monthly stats back to items
    const statement: StatementItem[] = tempItems.map(item => {
        const stats: any = monthlyStats[item.monthRef];

        // IR Logic
        // Swing Trade: 15% if Swing Sales > 20k
        let irSwing = 0;
        if (stats.swingSales > 20000 && stats.swingProfit > 0) {
            irSwing = stats.swingProfit * 0.15;
        }

        // Day Trade: 20% on profit (No limit)
        let irDt = 0;
        if (stats.dtProfit > 0) {
            irDt = stats.dtProfit * 0.20;
        }

        const totalIr = irSwing + irDt;

        return {
            ...item,
            monthlySales: stats.sales,
            monthlyPurchases: stats.purchases,
            monthlyProfit: stats.profit,
            irDue: totalIr
        };
    });

    return statement;
}

export async function getStockBalance(userId: number, symbol: string): Promise<number> {
    const transactions = await prisma.transaction.findMany({
        where: { userId, asset: { symbol } },
        select: { type: true, quantity: true }
    });

    let balance = 0;
    for (const tx of transactions) {
        if (tx.type === 'BUY') {
            balance += tx.quantity;
        } else if (tx.type === 'SELL') {
            balance -= tx.quantity;
        }
    }
    return balance;
}
