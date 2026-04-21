"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface WatchlistQuote {
    symbol: string;
    price: number;
    open: number;
    dayHigh: number;
    dayLow: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    changePercent: number;
    updatedAt: string;
}

interface WatchlistItem {
    id: number;
    symbol: string;
    target: number;
    createdAt: string;
    quote: WatchlistQuote | null;
}

export default function WatchlistPage() {
    const router = useRouter();
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [symbol, setSymbol] = useState('');
    const [target, setTarget] = useState('');

    useEffect(() => {
        const user = localStorage.getItem("user");
        if (!user) {
            router.push("/login");
            return;
        }
        fetchWatchlist();

        // Auto update every 60 seconds
        const intervalId = setInterval(fetchWatchlist, 60000);
        return () => clearInterval(intervalId);
    }, [router]);

    const fetchWatchlist = async () => {
        const userStr = localStorage.getItem("user");
        if (!userStr) return;
        const user = JSON.parse(userStr);

        try {
            const res = await fetch(`/api/watchlist?userId=${user.id}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setItems(data);
            }
        } catch (e) {
            console.error("Error fetching watchlist", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const userStr = localStorage.getItem("user");
        if (!userStr) return;
        const user = JSON.parse(userStr);

        if (!symbol || !target) return;

        try {
            const res = await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, symbol, target })
            });
            if (res.ok) {
                setSymbol('');
                setTarget('');
                fetchWatchlist();
            } else {
                alert("Erro ao adicionar ativo.");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        const userStr = localStorage.getItem("user");
        if (!userStr) return;
        const user = JSON.parse(userStr);

        if (!confirm("Deseja remover este ativo do acompanhamento?")) return;

        try {
            const res = await fetch(`/api/watchlist?userId=${user.id}&id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchWatchlist();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const getRowColorClass = (diff: number) => {
        if (diff < -3.00) return 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'; // Branco
        if (diff <= -1.50) return 'bg-red-500 text-white'; // Vermelho (-2.99 a -1.50)
        if (diff < -0.75) return 'bg-yellow-400 text-black'; // Amarelo (-1.49 a -0.75)
        return 'bg-green-500 text-white'; // Verde (>= -0.75, inclusive > 0)
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 dark:text-white">Acompanhamento de Ações</h1>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
                <form onSubmit={handleAdd} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Ação (Ticker)</label>
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            placeholder="Ex: PETR4"
                            required
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Alvo de Compra (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="0.00"
                            required
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                        />
                    </div>
                    <div className="flex-none">
                        <button type="submit" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800">
                            Adicionar
                        </button>
                    </div>
                </form>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow dark:bg-gray-800">
                {loading && <div className="p-8 text-center text-gray-500 dark:text-gray-400">Carregando cotações...</div>}
                {!loading && (
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-white uppercase bg-blue-600 dark:bg-blue-700">
                            <tr>
                                <th className="px-4 py-3">Ação</th>
                                <th className="px-4 py-3 text-right">Alvo</th>
                                <th className="px-4 py-3 text-right">Meta Compra (%)</th>
                                <th className="px-4 py-3 text-right">Prç. Ab</th>
                                <th className="px-4 py-3 text-right">Atual</th>
                                <th className="px-4 py-3 text-right">Menor prc Hj</th>
                                <th className="px-4 py-3 text-right">Menor 52 sem</th>
                                <th className="px-4 py-3 text-right">Maior 52 sem</th>
                                <th className="px-4 py-3 text-right">% abaixo maior</th>
                                <th className="px-4 py-3 text-right">% Hoje</th>
                                <th className="px-4 py-3 text-center">Data Hora</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="px-4 py-4 text-center">Nenhuma ação listada para acompanhamento.</td>
                                </tr>
                            )}
                            {items.map((item) => {
                                const qt = item.quote;
                                const atual = qt ? qt.price : 0;

                                // Meta compra: diff para alcançar o alvo
                                const metaCompra = atual && item.target
                                    ? ((atual - item.target) / item.target) * 100
                                    : 0;

                                // % abaixo maior
                                const percentAbaixoMaior = qt && qt.fiftyTwoWeekHigh > 0
                                    ? ((qt.fiftyTwoWeekHigh - atual) / qt.fiftyTwoWeekHigh) * 100
                                    : 0;

                                const colorClass = getRowColorClass(metaCompra);

                                let formattedDate = '-';
                                if (qt && qt.updatedAt) {
                                    try {
                                        formattedDate = new Date(qt.updatedAt).toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: '2-digit'
                                        });
                                    } catch (e) {
                                        formattedDate = '-';
                                    }
                                }

                                return (
                                    <tr key={item.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className={`px-4 py-3 font-bold ${colorClass}`}>
                                            {item.symbol}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                            R$ {item.target.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {metaCompra.toFixed(2)}%
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {qt ? `R$ ${qt.open.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                                            {qt ? `R$ ${atual.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                                            {qt ? `R$ ${qt.dayLow.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                                            {qt ? `R$ ${qt.fiftyTwoWeekLow.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                                            {qt ? `R$ ${qt.fiftyTwoWeekHigh.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-red-500">
                                            {percentAbaixoMaior.toFixed(2)}%
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${qt && qt.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {qt ? `${qt.changePercent > 0 ? '+' : ''}${qt.changePercent.toFixed(2)}%` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                                            {formattedDate}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800" title="Remover">
                                                ✖
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
