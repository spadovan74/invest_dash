"use client";

import { useEffect, useState } from "react";
import { getStockPrice, StockQuote } from "@/lib/market";

// Helper to fetch client-side if needed, or we can use a server component.
// Since it's a ticker that might update, client side fetch is fine.
// But getStockPrice is an async function we can call via a Server Action or Route Handler if it was secret,
// but it just fetches Yahoo public API. So we can call from Client IF we verify CORS.
// Yahoo API often blocks client-side CORS. Better to use an internal API route to proxy.

// Let's create a simple internal API route for quotes to avoid CORS issues on client.
// Actually lib/market runs on server if imported in server component. 
// But here we need client for the marquee. 
// Plan: Create Client Component, fetch from NEW internal API route `/api/quotes`.

export default function StockTicker() {
    const [quotes, setQuotes] = useState<{ symbol: string; data: StockQuote | null }[]>([]);

    const symbols = [
        { display: "IBOV", code: "^BVSP" },
        { display: "IFIX", code: "IFIX.SA" }, // Yahoo symbol for IFIX might be difficult, usually standard tickers. IFIX.SA often works.
        { display: "BITCOIN", code: "BTC-BRL" },
        { display: "PETR4", code: "PETR4.SA" },
        { display: "VALE3", code: "VALE3.SA" },
        { display: "ITUB4", code: "ITUB4.SA" },
        { display: "BBAS3", code: "BBAS3.SA" },
        { display: "WEGE3", code: "WEGE3.SA" },
    ];

    useEffect(() => {
        // Fetch data
        const fetchData = async () => {
            // We will perform parallel fetches to our own API which calls getStockPrice
            // To save requests, we could batch, but for now parallel is okay for 8 items.
            const promises = symbols.map(async (sym) => {
                try {
                    // Using a simple server action pattern or just fetch API if we make one.
                    // Let's assume we create /api/quote?symbol=...
                    const res = await fetch(`/api/quote?symbol=${sym.code}`);
                    if (res.ok) {
                        const data = await res.json();
                        return { symbol: sym.display, data };
                    }
                } catch (e) {
                    console.error(e);
                }
                return { symbol: sym.display, data: null };
            });

            const results = await Promise.all(promises);
            setQuotes(results);
        };

        fetchData();
        const interval = setInterval(fetchData, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-hidden h-10 flex items-center">
            <div className="animate-marquee whitespace-nowrap flex gap-8 items-center">
                {/* Duplicate list to ensure smooth infinite scroll if content is short */}
                {[...quotes, ...quotes, ...quotes].map((q, i) => (
                    <div key={i} className="inline-flex items-center gap-2 text-sm font-medium">
                        <span className="text-gray-700 dark:text-gray-300 font-bold">{q.symbol}</span>
                        {q.data ? (
                            <>
                                <span className="text-gray-900 dark:text-white">R${q.data.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                <span className={`${q.data.changePercent >= 0 ? 'text-green-600' : 'text-red-600'} text-xs`}>
                                    {q.data.changePercent > 0 ? '+' : ''}{q.data.changePercent.toFixed(2)}%
                                </span>
                            </>
                        ) : (
                            <span className="text-gray-400 text-xs">...</span>
                        )}
                    </div>
                ))}
            </div>
            <style jsx>{`
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
        </div>
    );
}
