
export interface StockQuote {
    price: number;
    changePercent: number;
}

export interface StockCandle {
    time: number; // Unix timestamp in seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export async function getStockHistory(symbol: string, range: string = '1mo', interval: string = '1d'): Promise<StockCandle[]> {
    let querySymbol = symbol.toUpperCase();
    if (!querySymbol.includes('.') && !querySymbol.includes('-') && !querySymbol.startsWith('^')) {
        querySymbol = `${querySymbol}.SA`;
    }

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?interval=${interval}&range=${range}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, { signal: controller.signal, next: { revalidate: 300 } } as any); // Cache for 5min
        clearTimeout(timeoutId);

        if (!res.ok) return [];

        const data = await res.json();
        const result = data.chart?.result?.[0];

        if (result && result.timestamp && result.indicators?.quote?.[0]) {
            const timestamps = result.timestamp;
            const quotes = result.indicators.quote[0];

            const candles: StockCandle[] = [];

            for (let i = 0; i < timestamps.length; i++) {
                // Filter out incomplete candles (null values)
                if (quotes.open[i] === null || quotes.close[i] === null) continue;

                // Yahoo returns timestamp in seconds, which is what Lightweight Charts wants for intraday
                candles.push({
                    time: timestamps[i],
                    open: quotes.open[i],
                    high: quotes.high[i],
                    low: quotes.low[i],
                    close: quotes.close[i],
                    volume: quotes.volume[i] || 0
                });
            }

            return candles;
        }
        return [];

    } catch (error) {
        console.error(`Error fetching history for ${symbol}:`, error);
        return [];
    }
}

export async function getStockPrice(symbol: string): Promise<StockQuote | null> {
    // Add .SA suffix for B3 stocks if not present, but ignore for indices/crypto if they have specific formats
    let querySymbol = symbol.toUpperCase();
    if (!querySymbol.includes('.') && !querySymbol.includes('-') && !querySymbol.startsWith('^')) {
        querySymbol = `${querySymbol}.SA`;
    }

    try {
        // Yahoo Finance Chart API (public endpoint)
        // We only need the latest price, so range=1d&interval=1d is sufficient, or even 1m.
        // metadata will have the `regularMarketPrice`.
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?interval=1d&range=1d`;

        // Set a timeout to avoid hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const res = await fetch(url, { signal: controller.signal, next: { revalidate: 60 } } as any);
        clearTimeout(timeoutId);

        if (!res.ok) {
            console.warn(`Failed to fetch price for ${symbol}: ${res.status}`);
            return null;
        }

        const data = await res.json();
        const result = data.chart?.result?.[0];

        if (result && result.meta) {
            // Calculate change percent if not directly provided (sometimes it's raw, sometimes we have previousClose)
            let changePercent = 0;
            if (result.meta.previousClose && result.meta.regularMarketPrice) {
                changePercent = ((result.meta.regularMarketPrice - result.meta.previousClose) / result.meta.previousClose) * 100;
            }

            return {
                price: result.meta.regularMarketPrice,
                changePercent: changePercent
            };
        }

        return null;
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        return null;
    }
}

export interface WatchlistQuote {
    symbol: string;
    price: number;
    open: number;
    dayHigh: number;
    dayLow: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    changePercent: number;
    updatedAt: Date;
}

export async function getWatchlistQuotes(symbols: string[]): Promise<Record<string, WatchlistQuote>> {
    const result: Record<string, WatchlistQuote> = {};
    if (!symbols || symbols.length === 0) return result;

    // Use multiple queries as the chart API fetches one symbol at a time or we fetch them concurrently
    await Promise.all(symbols.map(async (sym) => {
        let querySymbol = sym.toUpperCase();
        if (!querySymbol.includes('.') && !querySymbol.includes('-') && !querySymbol.startsWith('^')) {
            querySymbol = `${querySymbol}.SA`;
        }

        try {
            const url1d = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?interval=1m&range=1d`;
            const url1y = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?interval=1mo&range=1y`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const [res1d, res1y] = await Promise.all([
                fetch(url1d, { signal: controller.signal, next: { revalidate: 60 } } as any),
                fetch(url1y, { signal: controller.signal, next: { revalidate: 60 } } as any)
            ]);
            clearTimeout(timeoutId);

            if (!res1d.ok || !res1y.ok) {
                console.warn(`Failed to fetch complete watchlist quote for ${sym}`);
                return;
            }

            const data1d = await res1d.json();
            const data1y = await res1y.json();

            const chart1d = data1d.chart?.result?.[0];
            const chart1y = data1y.chart?.result?.[0];

            if (chart1d && chart1d.meta) {
                const meta = chart1d.meta;
                const rawSymbol = sym.toUpperCase();

                let changePercent = 0;
                if (meta.previousClose && meta.regularMarketPrice) {
                    changePercent = ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100;
                } else if (meta.chartPreviousClose && meta.regularMarketPrice) {
                    changePercent = ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;
                }

                let currentOpen = meta.regularMarketPrice || 0;
                let currentHigh = meta.regularMarketDayHigh || meta.regularMarketPrice || 0;
                let currentLow = meta.regularMarketDayLow || meta.regularMarketPrice || 0;

                const q1d = chart1d.indicators?.quote?.[0];
                if (q1d && q1d.open && q1d.high && q1d.low) {
                    const validOpens = q1d.open.filter((v: number | null) => v != null && v > 0);
                    const validHighs = q1d.high.filter((v: number | null) => v != null && v > 0);
                    const validLows = q1d.low.filter((v: number | null) => v != null && v > 0);

                    if (validOpens.length > 0) currentOpen = validOpens[0]; // first minute bar open
                    if (validHighs.length > 0) currentHigh = Math.max(...validHighs);
                    if (validLows.length > 0) currentLow = Math.min(...validLows);
                }

                let fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || meta.regularMarketPrice || 0;
                let fiftyTwoWeekLow = meta.fiftyTwoWeekLow || meta.regularMarketPrice || 0;

                const q1y = chart1y?.indicators?.quote?.[0];
                if (q1y && q1y.high && q1y.low) {
                    const validHighs1y = q1y.high.filter((v: number | null) => v != null && v > 0);
                    const validLows1y = q1y.low.filter((v: number | null) => v != null && v > 0);
                    if (validHighs1y.length > 0) fiftyTwoWeekHigh = Math.max(...validHighs1y);
                    if (validLows1y.length > 0) fiftyTwoWeekLow = Math.min(...validLows1y);
                }

                result[rawSymbol] = {
                    symbol: rawSymbol,
                    price: meta.regularMarketPrice || 0,
                    open: currentOpen,
                    dayHigh: currentHigh,
                    dayLow: currentLow,
                    fiftyTwoWeekHigh: fiftyTwoWeekHigh,
                    fiftyTwoWeekLow: fiftyTwoWeekLow,
                    changePercent: changePercent,
                    updatedAt: new Date((meta.regularMarketTime || Date.now() / 1000) * 1000),
                };
            }
        } catch (error) {
            console.error(`Error fetching watchlist quote for ${sym}:`, error);
        }
    }));

    return result;
}
