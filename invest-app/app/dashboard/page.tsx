"use client";

import { useEffect, useState } from "react";
import { PortfolioItem, TaxReport, PortfolioResult } from "@/lib/portfolio";
// import { ChartComponent } from "../components/ChartWrapper"; // Remove old chart
import StockChart from "../components/StockChart";

export default function DashboardPage() {
  const [data, setData] = useState<PortfolioResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('IBOV'); // Default

  const loadData = () => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      setLoading(false);
      return;
    }
    const user = JSON.parse(storedUser);

    fetch(`/api/portfolio?userId=${user.id}`)
      .then(res => res.json())
      .then((data: PortfolioResult) => {
        setData(data);
        setLoading(false);
        setLastUpdated(new Date());
        // Set default symbol if not set and we have positions
        if (!selectedSymbol && data.positions.length > 0) {
          setSelectedSymbol(data.positions[0].symbol);
        }
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  // Initial Load
  useEffect(() => {
    loadData();
  }, []);

  // Auto Refresh Interval
  useEffect(() => {
    if (!refreshInterval) return;

    const intervalId = setInterval(() => {
      console.log("Auto-refreshing data...");
      loadData();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  if (loading) return <div className="p-8">Carregando carteira...</div>;
  if (!data) return <div className="p-8">Erro ao carregar dados.</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <h1 className="text-3xl font-bold dark:text-white">Minha Carteira</h1>

        <div className="flex items-center gap-4 mt-4 md:mt-0">
          {lastUpdated && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Atualizado às: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <select
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            value={refreshInterval || ""}
            onChange={(e) => {
              const val = e.target.value;
              setRefreshInterval(val ? Number(val) : null);
            }}
          >
            <option value="">Não atualizar auto.</option>
            <option value="900000">A cada 15 min</option>
            <option value="1800000">A cada 30 min</option>
            <option value="3600000">A cada 1 hora</option>
          </select>
          <button
            onClick={loadData}
            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}

      {/* Chart Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 dark:text-white">Análise Gráfica</h2>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Buscar Ativo (ex: VALE3)"
          />
        </div>
        <StockChart symbol={selectedSymbol} />
      </div>

      {/* Tabela de Posições (Nova Visualização) */}
      <div className="mb-8 overflow-x-auto bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-white uppercase bg-blue-600 dark:bg-blue-700">
            <tr>
              <th className="px-6 py-3">Papel</th>
              <th className="px-6 py-3 text-right">Quantidade</th>
              <th className="px-6 py-3 text-right">Custo</th>
              <th className="px-6 py-3 text-right">Valor Mercado</th>
              <th className="px-6 py-3 text-right">Ganho realizado</th>
              <th className="px-6 py-3 text-right">Ganho (%)</th>
            </tr>
          </thead>
          <tbody>
            {data.positions.filter(p => p.quantity > 0).map((pos, index) => {
              const currentPrice = pos.currentPrice || pos.averagePrice;
              const marketValue = pos.quantity * currentPrice;
              const totalCost = pos.totalCost; // Already tracked correctly
              const unrealizedProfit = marketValue - totalCost;
              const profitPercent = totalCost > 0 ? (unrealizedProfit / totalCost) * 100 : 0;

              // Color logic
              const profitColor = unrealizedProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
              const bgClass = index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-700"; // Striped

              return (
                <tr
                  key={pos.symbol}
                  onClick={() => setSelectedSymbol(pos.symbol)}
                  className={`${bgClass} border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors duration-150`}
                >
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                    {pos.symbol}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                    {pos.quantity}
                  </td>
                  <td className="px-6 py-4 text-right">
                    R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    R$ {marketValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${profitColor}`}>
                    R$ {unrealizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${profitColor}`}>
                    {profitPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </td>
                </tr>
              );
            })}
            {data.positions.filter(p => p.quantity > 0).length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Nenhuma posição em aberto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tabela de IR */}
      <div className="mt-12 p-6 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-6 dark:text-white">Apuração de IR (Swing Trade)</h2>
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">Mês Ref.</th>
                <th className="px-6 py-3">Vendas Swing</th>
                <th className="px-6 py-3">Vendas Day Trade</th>
                <th className="px-6 py-3">IR Swing (15%)</th>
                <th className="px-6 py-3">IR Day Trade (20%)</th>
                <th className="px-6 py-3">Total a Pagar</th>
              </tr>
            </thead>
            <tbody>
              {data.taxReports.map((report) => (
                <tr key={report.month} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                  <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                    {report.month}
                  </td>
                  <td className="px-6 py-4">
                    R$ {report.swingSales.toFixed(2)}
                    {report.swingSales <= 20000 && <span className="text-xs text-green-500 block">(Isento)</span>}
                  </td>
                  <td className="px-6 py-4">
                    R$ {report.dtSales.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    R$ {report.irSwing.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    R$ {report.irDt.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-bold text-red-500">
                    R$ {report.totalIr.toFixed(2)}
                  </td>
                </tr>
              ))}
              {data.taxReports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">Nenhuma venda registrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Old Chart Removed */}
    </div>
  );
}
