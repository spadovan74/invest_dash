export interface CandleData {
    time: number;
    close: number;
}

export interface IndicatorData {
    time: number;
    value: number;
}

export function calculateEMA(data: CandleData[], period: number): IndicatorData[] {
    const k = 2 / (period + 1);
    let ema = data[0].close;
    const result: IndicatorData[] = [];

    // Simple Moving Average for first point? Or just start EMA?
    // Often SMA is used as seed. Let's use SMA for first 'period' items or just first item.
    // Simplifying: Start EMA from first close.

    // Better Standard: First EMA = SMA of 'period'
    if (data.length < period) return [];

    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i].close;
    }
    ema = sum / period;

    // Only push result starting from index 'period - 1'
    result.push({ time: data[period - 1].time, value: ema });

    for (let i = period; i < data.length; i++) {
        const close = data[i].close;
        ema = (close - ema) * k + ema;
        result.push({ time: data[i].time, value: ema });
    }

    return result;
}

export function calculateRSI(data: CandleData[], period: number = 14): IndicatorData[] {
    if (data.length <= period) return [];

    const result: IndicatorData[] = [];
    let gains = 0;
    let losses = 0;

    // First average gain/loss
    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - (100 / (1 + rs));

    result.push({ time: data[period].time, value: rsi });

    // Subsequent values
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        const currentGain = diff > 0 ? diff : 0;
        const currentLoss = diff < 0 ? Math.abs(diff) : 0;

        // Smoothed averages
        avgGain = ((avgGain * (period - 1)) + currentGain) / period;
        avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

        rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));

        result.push({ time: data[i].time, value: rsi });
    }

    return result;
}
