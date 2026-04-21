"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface MonthlyTaxReport {
    month: string;
    swingSales: number;
    swingProfit: number;
    swingTaxableProfit: number;
    swingLossAccumulated: number;
    irSwing: number;
    dtSales: number;
    dtProfit: number;
    dtTaxableProfit: number;
    dtLossAccumulated: number;
    irDt: number;
    totalIrDue: number;
}

interface AnnualAssetPosition {
    symbol: string;
    quantity: number;
    averagePrice: number;
    totalCost: number;
}

export default function TaxesPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'monthly' | 'annual'>('monthly');
    const [loading, setLoading] = useState(false);

    // Mensal (DARF) State
    const [monthlyReports, setMonthlyReports] = useState<MonthlyTaxReport[]>([]);

    // Anual (Bens e Direitos) State
    const [annualYear, setAnnualYear] = useState<number>(new Date().getFullYear());
    const [annualPositions, setAnnualPositions] = useState<AnnualAssetPosition[]>([]);

    useEffect(() => {
        const user = localStorage.getItem("user");
        if (!user) {
            router.push("/login");
        } else {
            fetchMonthlyTaxes();
        }
    }, [router]);

    useEffect(() => {
        if (activeTab === 'annual') {
            fetchAnnualTaxes(annualYear);
        }
    }, [activeTab, annualYear]);

    const fetchMonthlyTaxes = async () => {
        setLoading(true);
        const userStr = localStorage.getItem("user");
        if (!userStr) return;
        const user = JSON.parse(userStr);

        try {
            const res = await fetch(`/api/taxes/monthly?userId=${user.id}`);
            const data = await res.json();
            setMonthlyReports(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnnualTaxes = async (year: number) => {
        setLoading(true);
        const userStr = localStorage.getItem("user");
        if (!userStr) return;
        const user = JSON.parse(userStr);

        try {
            const res = await fetch(`/api/taxes/annual?userId=${user.id}&year=${year}`);
            const data = await res.json();
            setAnnualPositions(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:ml-64 pt-24 bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Declaração e Impostos</h1>

                {/* Tabs */}
                <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                    <ul className="flex flex-wrap -mb-px text-sm font-medium text-center" role="tablist">
                        <li className="mr-2" role="presentation">
                            <button
                                className={`inline-block p-4 border-b-2 rounded-t-lg ${activeTab === 'monthly'
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-500 dark:border-blue-500'
                                    : 'border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300'
                                    }`}
                                onClick={() => setActiveTab('monthly')}
                                type="button"
                            >
                                Apuração Mensal (DARF)
                            </button>
                        </li>
                        <li className="mr-2" role="presentation">
                            <button
                                className={`inline-block p-4 border-b-2 rounded-t-lg ${activeTab === 'annual'
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-500 dark:border-blue-500'
                                    : 'border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300'
                                    }`}
                                onClick={() => setActiveTab('annual')}
                                type="button"
                            >
                                Bens e Direitos Anual (IRPF)
                            </button>
                        </li>
                    </ul>
                </div>

                {/* Tab Content */}
                {loading ? (
                    <div className="flex justify-center my-10">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <div>
                        {activeTab === 'monthly' && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Resumo e Compensação de Prejuízos</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                                            <tr>
                                                <th scope="col" className="px-6 py-3">Mês</th>
                                                <th scope="col" className="px-6 py-3 text-right">Vendas ST</th>
                                                <th scope="col" className="px-6 py-3 text-right">Lucro/Prejuízo ST</th>
                                                <th scope="col" className="px-6 py-3 text-right">Acumulado ST (-)</th>
                                                <th scope="col" className="px-6 py-3 text-right">Vendas DT</th>
                                                <th scope="col" className="px-6 py-3 text-right">Lucro/Prejuízo DT</th>
                                                <th scope="col" className="px-6 py-3 text-right">Acumulado DT (-)</th>
                                                <th scope="col" className="px-6 py-3 text-right">IR Devido Total</th>
                                                <th scope="col" className="px-6 py-3 text-center">Status DARF</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthlyReports.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="px-6 py-4 text-center">Nenhuma operação registrada ainda.</td>
                                                </tr>
                                            ) : (
                                                monthlyReports.map((report) => (
                                                    <tr key={report.month} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                                                            {report.month}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">R$ {report.swingSales.toFixed(2)}</td>
                                                        <td className={`px-6 py-4 text-right font-medium ${report.swingProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            R$ {report.swingProfit.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-red-500">
                                                            {report.swingLossAccumulated < 0 ? `R$ ${report.swingLossAccumulated.toFixed(2)}` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">R$ {report.dtSales.toFixed(2)}</td>
                                                        <td className={`px-6 py-4 text-right font-medium ${report.dtProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            R$ {report.dtProfit.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-red-500">
                                                            {report.dtLossAccumulated < 0 ? `R$ ${report.dtLossAccumulated.toFixed(2)}` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                                                            R$ {report.totalIrDue.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 text-center flex flex-col gap-1 items-center justify-center h-full">
                                                            {report.swingProfit > 0 && report.swingSales <= 20000 && (
                                                                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded w-max dark:bg-blue-900 dark:text-blue-300" title="Lucro de Ações normal Isento (Vendas no mês <= 20k)">ST Isento (20k)</span>
                                                            )}
                                                            {report.swingProfit < 0 && (
                                                                <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded w-max dark:bg-yellow-900 dark:text-yellow-300">ST Perda</span>
                                                            )}
                                                            {report.dtProfit < 0 && (
                                                                <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded w-max dark:bg-yellow-900 dark:text-yellow-300">DT Perda</span>
                                                            )}
                                                            {report.totalIrDue > 0 && (
                                                                <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded w-max dark:bg-red-900 dark:text-red-300">Pagar DARF</span>
                                                            )}
                                                            {report.totalIrDue <= 0 && report.swingProfit <= 0 && report.dtProfit <= 0 && (
                                                                <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded w-max dark:bg-gray-700 dark:text-gray-300">Sem Mov. Tributável</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'annual' && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Informe para IRPF - Bens e Direitos</h2>
                                    <div className="flex items-center space-x-2">
                                        <label htmlFor="year" className="text-sm font-medium text-gray-900 dark:text-white">Ano-Base:</label>
                                        <input
                                            type="number"
                                            id="year"
                                            value={annualYear}
                                            onChange={(e) => setAnnualYear(Number(e.target.value))}
                                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-24 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 border border-blue-200 dark:border-blue-800 rounded-lg mb-6">
                                    <p className="text-sm text-blue-800 dark:text-blue-300">
                                        <strong>Como Declarar:</strong> Grupo 03 (Participações Societárias) - Código 01 (Ações).
                                        Use o texto sugerido abaixo na coluna Discriminação. Os valores correspondem ao Custo de Aquisição (Preço Médio x Quantidade).
                                    </p>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                                            <tr>
                                                <th scope="col" className="px-6 py-3">Ativo</th>
                                                <th scope="col" className="px-6 py-3 w-1/2">Discriminação (Sugestão IRPF)</th>
                                                <th scope="col" className="px-6 py-3 text-right">Situação Média (PM)</th>
                                                <th scope="col" className="px-6 py-3 text-right">Situação em 31/12/{annualYear}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {annualPositions.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-4 text-center">Nenhuma custódia registrada em 31/12/{annualYear}.</td>
                                                </tr>
                                            ) : (
                                                annualPositions.map((pos) => (
                                                    <tr key={pos.symbol} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                                            {pos.symbol}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="font-mono text-xs dark:text-gray-300">
                                                                {pos.quantity} ações de {pos.symbol} ao preço médio de R$ {pos.averagePrice.toFixed(2)}. Corretora: Genial/Clear/BTG.
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">R$ {pos.averagePrice.toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                                                            R$ {pos.totalCost.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
