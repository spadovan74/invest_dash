"use client";

import { createChart, IChartApi, ColorType, ISeriesApi, MouseEventParams } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { calculateEMA, calculateRSI } from '@/lib/indicators';

interface StockChartProps {
    symbol: string;
}

export default function StockChart({ symbol }: StockChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const rsiContainerRef = useRef<HTMLDivElement>(null);

    // Tooltip Refs
    const tooltipRef = useRef<HTMLDivElement>(null);

    const chartRef = useRef<IChartApi | null>(null);
    const rsiChartRef = useRef<IChartApi | null>(null);

    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const ema9Ref = useRef<ISeriesApi<"Line"> | null>(null);
    const ema21Ref = useRef<ISeriesApi<"Line"> | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    const [range, setRange] = useState('1mo');
    const [loading, setLoading] = useState(false);

    const dataRef = useRef<any[]>([]);

    // Initialize Charts
    useEffect(() => {
        if (!chartContainerRef.current || !rsiContainerRef.current) return;

        // --- Main Chart ---
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9CA3AF',
            },
            grid: {
                vertLines: { color: '#E5E7EB10' },
                horzLines: { color: '#E5E7EB10' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 350,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    width: 1,
                    color: '#C3BCDB44',
                    style: 0,
                    labelBackgroundColor: '#9B7DFF',
                },
                horzLine: {
                    color: '#9B7DFF',
                    labelBackgroundColor: '#9B7DFF',
                },
            },
        });

        const series = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        const ema9 = chart.addLineSeries({ color: '#2962FF', lineWidth: 1, title: 'EMA 9', crosshairMarkerVisible: false });
        // EMA 21 - We might want to hide it on 1D/5D if it's too noisy, but normally fine.
        const ema21 = chart.addLineSeries({ color: '#FF6D00', lineWidth: 1, title: 'EMA 21', crosshairMarkerVisible: false });

        seriesRef.current = series;
        ema9Ref.current = ema9;
        ema21Ref.current = ema21;
        chartRef.current = chart;

        // --- Tooltip Logic ---
        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (!tooltipRef.current || !chartContainerRef.current) return;

            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > chartContainerRef.current.clientWidth ||
                param.point.y < 0 ||
                param.point.y > chartContainerRef.current.clientHeight
            ) {
                tooltipRef.current.style.display = 'none';
                return;
            }

            const data: any = param.seriesData.get(series);

            if (data) {
                tooltipRef.current.style.display = 'block';

                // Find original data for volume
                // Param.time is the timestamp (number)
                const originalData = dataRef.current.find((d: any) => d.time === param.time);
                const rawVolume = originalData ? originalData.volume : 0;

                // Format Date
                // If intraday (1d/5d), show Time. If daily, show Date.
                // We can guess based on data granularity or just always show full date if space permits.
                // Yahoo format: '1/16 11:46 AM' for intraday
                const dateObj = new Date((param.time as number) * 1000);

                let dateStr = dateObj.toLocaleDateString('pt-BR');
                // Check if we show time (if range implies intraday)
                if (['1d', '5d', '1mo'].includes(range)) {
                    dateStr = dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                }

                tooltipRef.current.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 4px; color: ${data.close >= data.open ? '#26a69a' : '#ef5350'}">${dateStr}</div>
                    <div style="display: flex; justify-content: space-between;"><span>Abertura:</span> <span>${data.open.toFixed(2)}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Máxima:</span> <span>${data.high.toFixed(2)}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Mínima:</span> <span>${data.low.toFixed(2)}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Fechamento:</span> <span>${data.close.toFixed(2)}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px solid #eee; padding-top: 2px;">
                        <span>Vol:</span> <span>${(rawVolume / 1000).toFixed(0)}K</span>
                    </div>
                `;

                // Dynamic Positioning
                const tooltipWidth = 140;
                const tooltipHeight = 140;
                let left = param.point.x + 10;
                let top = param.point.y + 10;

                if (left + tooltipWidth > chartContainerRef.current.clientWidth) {
                    left = param.point.x - tooltipWidth - 10;
                }
                if (top + tooltipHeight > chartContainerRef.current.clientHeight) {
                    top = param.point.y - tooltipHeight - 10;
                }

                tooltipRef.current.style.left = left + 'px';
                tooltipRef.current.style.top = top + 'px';
            }
        });


        // --- RSI Chart ---
        const rsiChart = createChart(rsiContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9CA3AF',
            },
            grid: {
                vertLines: { color: '#E5E7EB10' },
                horzLines: { color: '#E5E7EB10' },
            },
            width: rsiContainerRef.current.clientWidth,
            height: 150,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const rsiSeries = rsiChart.addLineSeries({ color: '#7E57C2', lineWidth: 1, title: 'RSI 14', crosshairMarkerVisible: true });
        rsiSeries.createPriceLine({ price: 70, color: '#EF5350', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '70' });
        rsiSeries.createPriceLine({ price: 30, color: '#26A69A', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '30' });

        rsiSeriesRef.current = rsiSeries;
        rsiChartRef.current = rsiChart;

        // --- Synchronization ---
        const mainTimeScale = chart.timeScale();
        const rsiTimeScale = rsiChart.timeScale();

        mainTimeScale.subscribeVisibleLogicalRangeChange(range => {
            if (range) rsiTimeScale.setVisibleLogicalRange(range);
        });

        rsiTimeScale.subscribeVisibleLogicalRangeChange(range => {
            if (range) mainTimeScale.setVisibleLogicalRange(range);
        });

        const handleResize = () => {
            const w = chartContainerRef.current?.clientWidth || 0;
            if (chartContainerRef.current) chart.applyOptions({ width: w });
            if (rsiContainerRef.current) rsiChart.applyOptions({ width: w });
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            rsiChart.remove();
        };
    }, []); // Only rebuild on mount, change data dynamically

    // Fetch Data
    useEffect(() => {
        if (!symbol) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Determine Interval logic
                let interval = '1d';

                switch (range) {
                    case '1d': interval = '2m'; break; // Intraday
                    case '5d': interval = '15m'; break; // Intraday
                    case '1mo': interval = '60m'; break; // Hourly for 1mo allows 21 EMA to display better than 20 daily bars
                    case '3mo': interval = '1d'; break;
                    case '6mo': interval = '1d'; break;
                    case 'ytd': interval = '1d'; break;
                    case '1y': interval = '1d'; break;
                    case '5y': interval = '1wk'; break;
                    case 'max': interval = '1mo'; break;
                    default: interval = '1d';
                }

                const res = await fetch(`/api/market/history?symbol=${symbol}&range=${range}&interval=${interval}`);
                if (!res.ok) throw new Error('Failed to fetch');

                const data = await res.json();

                if (Array.isArray(data) && data.length > 0) {
                    const validData = data.filter(d => d.open != null && d.close != null && d.time != null);

                    dataRef.current = validData;

                    // Lightweight charts requires sorted time. Usually API sends sorted.
                    // Also needs unique time.

                    // Update Chart TimeScale options for Intraday vs Daily
                    const isIntraday = ['1d', '5d', '1mo'].includes(range);
                    chartRef.current?.applyOptions({
                        timeScale: {
                            timeVisible: isIntraday,
                            secondsVisible: false,
                        }
                    });
                    rsiChartRef.current?.applyOptions({
                        timeScale: {
                            timeVisible: isIntraday,
                            secondsVisible: false,
                        }
                    });

                    seriesRef.current?.setData(validData);

                    const ema9Data = calculateEMA(validData, 9);
                    const ema21Data = calculateEMA(validData, 21);
                    const rsiData = calculateRSI(validData, 14);

                    ema9Ref.current?.setData(ema9Data);
                    ema21Ref.current?.setData(ema21Data);
                    rsiSeriesRef.current?.setData(rsiData);

                    chartRef.current?.timeScale().fitContent();
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Hack: Make range access inside effect? No, depend on [range, symbol]
    }, [symbol, range]);

    const ranges = [
        { label: '1D', value: '1d' },
        { label: '5D', value: '5d' },
        { label: '1M', value: '1mo' },
        { label: '3M', value: '3mo' },
        { label: '6M', value: '6mo' },
        { label: 'YTD', value: 'ytd' },
        { label: '1A', value: '1y' },
        { label: '5A', value: '5y' },
        { label: 'Máx', value: 'max' },
    ];

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-8 relative">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {symbol}
                    {loading && <span className="text-xs text-gray-500 animate-pulse">Carregando...</span>}
                </h3>
                <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    {ranges.map((r) => (
                        <button
                            key={r.value}
                            onClick={() => setRange(r.value)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${range === r.value ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Chart */}
            <div className="relative">
                <div ref={chartContainerRef} className="w-full h-[350px]" />

                {/* Tooltip */}
                <div
                    ref={tooltipRef}
                    className="absolute hidden pointer-events-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2 rounded shadow-lg text-xs z-20 opacity-90"
                    style={{ width: '140px' }}
                >
                    {/* Content injected by JS */}
                </div>
            </div>

            {/* RSI Chart */}
            <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                <h4 className="text-xs font-semibold text-gray-500 mb-1 ml-2">RSI (14)</h4>
                <div ref={rsiContainerRef} className="w-full h-[150px]" />
            </div>
        </div>
    );
}
