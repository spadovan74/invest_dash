import prisma from '@/lib/prisma';

export interface MonthlyTaxReport {
    month: string; // "YYYY-MM"

    swingSales: number;
    swingProfit: number;
    swingTaxableProfit: number; // Lucro tributável (após abater prejuízos)
    swingLossAccumulated: number; // Prejuízo acumulado que passa para o próximo mês
    irSwing: number; // IR a pagar (15%)

    dtSales: number;
    dtProfit: number;
    dtTaxableProfit: number;
    dtLossAccumulated: number;
    irDt: number; // IR a pagar (20%)

    totalIrDue: number; // Total do DARF
}

export async function getMonthlyTaxReports(userId: number): Promise<MonthlyTaxReport[]> {
    const transactions = await prisma.transaction.findMany({
        where: { userId, type: { in: ['BUY', 'SELL'] } },
        include: { asset: true },
        orderBy: { date: 'asc' },
    });

    // Estado Atual do Portfólio (para Custo Médio e Quantidade)
    const positions: Record<string, { quantity: number; avgPrice: number }> = {};

    // Meses Encontrados (para ordenação)
    const monthsSet = new Set<string>();

    const rawMonthlyStats: Record<string, {
        swingSales: number;
        dtSales: number;
        swingProfit: number;
        dtProfit: number;
    }> = {};

    let todaysBuys: Record<string, number> = {};
    let currentProcessingDate = '';

    // 1. Fase de Processamento de Transações (Cálculo de Lucro/Prejuízo Bruto)
    for (const tx of transactions) {
        const symbol = tx.asset.symbol;
        const date = new Date(tx.date);
        const dateStr = date.toISOString().slice(0, 10);
        // Usar formato YYYY-MM para facilitar sortação ISO
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        monthsSet.add(monthKey);

        if (dateStr !== currentProcessingDate) {
            currentProcessingDate = dateStr;
            todaysBuys = {};
        }

        if (!positions[symbol]) {
            positions[symbol] = { quantity: 0, avgPrice: 0 };
        }

        if (!rawMonthlyStats[monthKey]) {
            rawMonthlyStats[monthKey] = {
                swingSales: 0,
                dtSales: 0,
                swingProfit: 0,
                dtProfit: 0
            };
        }

        const pos = positions[symbol];
        const fees = (tx.brokerage || 0) + (tx.otherFees || 0);
        const totalOp = tx.quantity * tx.price;

        if (tx.type === 'BUY') {
            const currentTotalCost = pos.quantity * pos.avgPrice;
            const operationCost = totalOp + fees;
            const newTotalCost = currentTotalCost + operationCost;
            const newQuantity = pos.quantity + tx.quantity;

            pos.avgPrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
            pos.quantity = newQuantity;

            // Day Trade tracking
            if (!todaysBuys[symbol]) todaysBuys[symbol] = 0;
            todaysBuys[symbol] += tx.quantity;

        } else if (tx.type === 'SELL') {
            const boughtToday = todaysBuys[symbol] || 0;
            let dtQuantity = 0;

            if (boughtToday > 0) {
                dtQuantity = Math.min(tx.quantity, boughtToday);
                todaysBuys[symbol] -= dtQuantity;
            }

            const costOfSoldShares = tx.quantity * pos.avgPrice;
            const grossProfit = totalOp - costOfSoldShares;
            const netProfit = grossProfit - fees; // L/P Líquido da operação

            const dtRatio = dtQuantity / tx.quantity;
            const dtProfit = netProfit * dtRatio;
            const stProfit = netProfit * (1 - dtRatio);

            const dtSaleValue = totalOp * dtRatio;
            const stSaleValue = totalOp * (1 - dtRatio);

            pos.quantity -= tx.quantity;

            rawMonthlyStats[monthKey].dtSales += dtSaleValue;
            rawMonthlyStats[monthKey].swingSales += stSaleValue;
            rawMonthlyStats[monthKey].dtProfit += dtProfit;
            rawMonthlyStats[monthKey].swingProfit += stProfit;
        }
    }

    // Ordenar os meses cronologicamente para o Rollover de Prejuízo
    const sortedMonths = Array.from(monthsSet).sort();

    const reports: MonthlyTaxReport[] = [];
    let accumulatedSwingLoss = 0;
    let accumulatedDtLoss = 0;

    // 2. Fase de Aplicação de Regras Fiscais (Compensação e Isenção)
    for (const month of sortedMonths) {
        const stat = rawMonthlyStats[month];

        // --- Lógica DAY TRADE ---
        let currentDtProfit = stat.dtProfit;
        let dtTaxable = 0;

        if (currentDtProfit < 0) {
            // Aumenta o prejuízo acumulado (negativo)
            accumulatedDtLoss += currentDtProfit;
        } else if (currentDtProfit > 0) {
            // Tenta abater do prejuízo acumulado
            if (accumulatedDtLoss < 0) {
                const deduction = Math.min(currentDtProfit, Math.abs(accumulatedDtLoss));
                dtTaxable = currentDtProfit - deduction;
                // Abate do saldo devedor
                accumulatedDtLoss += deduction;
            } else {
                dtTaxable = currentDtProfit;
            }
        }
        const irDt = dtTaxable > 0 ? dtTaxable * 0.20 : 0;

        // --- Lógica SWING TRADE ---
        let currentSwingProfit = stat.swingProfit;
        let swingTaxable = 0;
        let irSwing = 0;

        if (currentSwingProfit < 0) {
            // Aumenta o prejuízo acumulado ST (negativo)
            accumulatedSwingLoss += currentSwingProfit;
        } else if (currentSwingProfit > 0) {
            // Abate de prejuizo só entra se não for isento!
            // Para Swing Trade de Ações, há isenção se vendas totais no mês <= R$ 20.000,00
            // ATENÇÃO: Lucro isento NÃO consome saldo de prejuízo acumulado!
            if (stat.swingSales <= 20000) {
                // Lucro ISENTO.
                swingTaxable = 0;
            } else {
                // Tributável. Abater prejuízos acumulados se houver.
                if (accumulatedSwingLoss < 0) {
                    const deduction = Math.min(currentSwingProfit, Math.abs(accumulatedSwingLoss));
                    swingTaxable = currentSwingProfit - deduction;
                    accumulatedSwingLoss += deduction;
                } else {
                    swingTaxable = currentSwingProfit;
                }
            }
        }

        if (swingTaxable > 0) {
            irSwing = swingTaxable * 0.15;
        }

        reports.push({
            month,
            swingSales: stat.swingSales,
            swingProfit: stat.swingProfit,
            swingTaxableProfit: swingTaxable,
            swingLossAccumulated: accumulatedSwingLoss, // Posição do prejuízo ao final do mês
            irSwing: irSwing,

            dtSales: stat.dtSales,
            dtProfit: stat.dtProfit,
            dtTaxableProfit: dtTaxable,
            dtLossAccumulated: accumulatedDtLoss, // Posição do prejuízo DD ao final do mês
            irDt: irDt,

            totalIrDue: irSwing + irDt
        });
    }

    // Podemos querer retornar em ordem reversa (mais recente primeiro) para a UI
    return reports.reverse();
}

// Bônus: Lógica do Final de Ano (Bens e Direitos) - Custódia Histórica
export interface AnnualAssetPosition {
    symbol: string;
    quantity: number;
    averagePrice: number;
    totalCost: number; // O "Custo" é o exigido na declaração, e não o valor de mercado.
}

export async function getAnnualPositions(userId: number, year: number): Promise<AnnualAssetPosition[]> {
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

    // Pegar todas operações ATÉ o fim daquele ano cronologicamente
    const transactions = await prisma.transaction.findMany({
        where: {
            userId,
            type: { in: ['BUY', 'SELL'] },
            date: { lte: endOfYear }
        },
        include: { asset: true },
        orderBy: { date: 'asc' },
    });

    const positions: Record<string, { quantity: number; avgPrice: number }> = {};

    for (const tx of transactions) {
        const symbol = tx.asset.symbol;
        if (!positions[symbol]) {
            positions[symbol] = { quantity: 0, avgPrice: 0 };
        }

        const pos = positions[symbol];
        const fees = (tx.brokerage || 0) + (tx.otherFees || 0);
        const totalOp = tx.quantity * tx.price;

        if (tx.type === 'BUY') {
            const currentTotalCost = pos.quantity * pos.avgPrice;
            const newTotalCost = currentTotalCost + totalOp + fees;
            const newQuantity = pos.quantity + tx.quantity;
            pos.avgPrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
            pos.quantity = newQuantity;
        } else if (tx.type === 'SELL') {
            pos.quantity -= tx.quantity;
            // Se zerar estoques no ano e comprar depois, não recria average price (avgPrice is only kept for next buy, which overwrites if 0)
        }
    }

    const report: AnnualAssetPosition[] = [];
    for (const symbol in positions) {
        const p = positions[symbol];
        // Só declarar ativos que o usuário detinha custódia na virada do ano
        if (p.quantity > 0) {
            report.push({
                symbol,
                quantity: p.quantity,
                averagePrice: p.avgPrice,
                totalCost: p.quantity * p.avgPrice
            });
        }
    }

    return report.sort((a, b) => a.symbol.localeCompare(b.symbol));
}
