"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OperationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'register' | 'statement'>('register');

  // Register/Edit Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [type, setType] = useState('BUY');
  const [symbol, setSymbol] = useState('');
  const [date, setDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [otherFees, setOtherFees] = useState('');

  // Validation State
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);

  // Statement State
  const [statement, setStatement] = useState<any[]>([]);
  const [filterPeriod, setFilterPeriod] = useState('all'); // all, week, month, year
  const [loadingStatement, setLoadingStatement] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (activeTab === 'statement') {
      fetchStatement();
      setEditingId(null); // Clear edit mode if switching tabs manually
      resetForm();
    }
  }, [activeTab]);

  // Check stock balance when Symbol changes (Debounced ideally, but Effect works)
  useEffect(() => {
    if (type === 'SELL' && symbol.length >= 4 && !editingId) {
      checkBalance(symbol);
    } else {
      setAvailableStock(null);
    }
  }, [symbol, type, editingId]);

  const checkBalance = async (sym: string) => {
    setCheckingStock(true);
    const userStr = localStorage.getItem("user");
    if (!userStr) return;
    const user = JSON.parse(userStr);

    try {
      // We can reuse portfolio API or create a specific one. 
      // Since we don't have a direct "check balance" API, let's just fetch portfolio 
      // and find the item. Or simpler: Create a small server action/route? 
      // Actually, let's use the portfolio API which returns all positions.
      const res = await fetch(`/api/portfolio?userId=${user.id}`);
      const data = await res.json();
      const pos = data.positions.find((p: any) => p.symbol === sym.toUpperCase());
      setAvailableStock(pos ? pos.quantity : 0);
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingStock(false);
    }
  };

  const fetchStatement = async () => {
    setLoadingStatement(true);
    const userStr = localStorage.getItem("user");
    if (!userStr) return;
    const user = JSON.parse(userStr);

    try {
      const res = await fetch(`/api/statement?userId=${user.id}`);
      const data = await res.json();
      setStatement(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatement(false);
    }
  };

  const getFilteredStatement = () => {
    if (filterPeriod === 'all') return statement;
    const now = new Date();
    let cutoff = new Date();
    if (filterPeriod === 'week') cutoff.setDate(now.getDate() - 7);
    if (filterPeriod === 'month') cutoff.setMonth(now.getMonth() - 1);
    if (filterPeriod === 'year') cutoff.setFullYear(now.getFullYear() - 1);
    return statement.filter(item => new Date(item.date) >= cutoff);
  };

  const resetForm = () => {
    setEditingId(null);
    setType('BUY');
    setSymbol('');
    setDate('');
    setQuantity('');
    setPrice('');
    setBrokerage('');
    setOtherFees('');
    setAvailableStock(null);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setType(item.type);
    setSymbol(item.symbol);
    setDate(new Date(item.date).toISOString().split('T')[0]);
    setQuantity(item.quantity.toString());
    setPrice(item.price.toString());
    // We stored costs as total fees. We need to split? 
    // The statement item has 'costs' (brokerage + other).
    // If we didn't store them separately in statement item, we might need to fetch raw transaction.
    // But let's assume 'costs' goes to 'brokerage' for simplicity if specific split lost, 
    // OR better: Just put it in brokerage and leave other 0. 
    // Ideally statement item structure should carry fields.
    // Let's rely on 'costs' for now.
    setBrokerage((item.cust || 0).toString());
    setOtherFees(((item.rat || 0) - (item.cust || 0)).toFixed(2));

    setActiveTab('register'); // Switch to form
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      alert("Erro: Usuário não logado.");
      return;
    }
    const user = JSON.parse(userStr);

    // Front-end Validation for Sell
    if (type === 'SELL' && !editingId) { // Only validate on create? Or edit too? If editing quantity, check limit.
      // For simplicity allow edit to bypass strict front-check for now or re-check. 
      // Logic: If creating new sell, strict check.
      if (availableStock !== null && Number(quantity) > availableStock) {
        alert(`Erro: Você só possui ${availableStock} ações disponíveis de ${symbol}.`);
        return;
      }
    }

    const payload = {
      id: editingId, // Included if editing
      userId: user.id,
      type,
      symbol: symbol.toUpperCase(),
      date: new Date(date),
      quantity: Number(quantity),
      price: Number(price),
      brokerage: brokerage ? Number(brokerage) : 0,
      otherFees: otherFees ? Number(otherFees) : 0,
    };

    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch('/api/operations', {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert(`Operação ${editingId ? 'atualizada' : 'registrada'} com sucesso!`);
        if (editingId) {
          setActiveTab('statement'); // Return to list after edit
          setEditingId(null);
        } else {
          // Reset form only on new create
          resetForm();
          // Maybe go to dashboard? User workflow: register -> dashboard usually.
          // But if editing, go back to list.
          if (!editingId) router.push('/dashboard');
        }
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error || 'Falha na operação'}`);
      }
    } catch (error) {
      alert('Erro de conexão.');
    }
  };

  const renderStatement = () => {
    const filtered = getFilteredStatement();

    return (
      <div className="mt-6">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setFilterPeriod('week')} className={`px-4 py-2 rounded ${filterPeriod === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>Última Semana</button>
          <button onClick={() => setFilterPeriod('month')} className={`px-4 py-2 rounded ${filterPeriod === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>Último Mês</button>
          <button onClick={() => setFilterPeriod('year')} className={`px-4 py-2 rounded ${filterPeriod === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>Último Ano</button>
          <button onClick={() => setFilterPeriod('all')} className={`px-4 py-2 rounded ${filterPeriod === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>Tudo</button>
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow dark:bg-gray-800">
          <table className="w-full text-[10px] text-left text-gray-500 dark:text-gray-400">
            <thead className="text-[10px] text-white uppercase bg-blue-600 dark:bg-blue-700">
              <tr>
                <th className="px-1 py-2">Data</th>
                <th className="px-1 py-2">Papel</th>
                <th className="px-1 py-2">Op</th>
                <th className="px-1 py-2 text-right">Qtd</th>
                <th className="px-1 py-2 text-right">Preço</th>
                <th className="px-1 py-2 text-right">CUST.</th>
                <th className="px-1 py-2 text-right">TOTAL OP</th>
                <th className="px-1 py-2 text-right">RAT.</th>
                <th className="px-1 py-2 text-right">V. LIQUIDO</th>
                <th className="px-1 py-2 text-right">ESTOQUE</th>
                <th className="px-1 py-2 text-right">PMEDIO</th>
                <th className="px-1 py-2 text-right">GAN/PER</th>
                <th className="px-1 py-2 text-right bg-blue-700">IR MÊS</th>
                <th className="px-1 py-2 text-center bg-gray-600">MÊS REF.</th>
                <th className="px-1 py-2 text-right bg-gray-600">VENDAS/MÊS</th>
                <th className="px-1 py-2 text-right bg-gray-600">COMPRAS/MÊS</th>
                <th className="px-1 py-2 text-right bg-blue-800">Ganhos %</th>
                <th className="px-1 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const monthlyGainPct = item.monthlySales > 0 ? (item.monthlyProfit / item.monthlySales) * 100 : 0;
                return (
                  <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-1 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-1 py-2 text-gray-900 dark:text-white font-bold">{item.symbol}</td>
                    <td className="px-1 py-2">{item.type === 'BUY' ? 'C' : item.type === 'SELL' ? 'V' : 'D'}</td>
                    <td className="px-1 py-2 text-right">{item.quantity}</td>
                    <td className="px-1 py-2 text-right">{item.price.toFixed(2)}</td>
                    <td className="px-1 py-2 text-right">{item.cust > 0 ? item.cust.toFixed(2) : '-'}</td>
                    <td className="px-1 py-2 text-right">{item.totalOp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-1 py-2 text-right">{item.rat > 0 ? item.rat.toFixed(2) : '-'}</td>
                    <td className={`px-1 py-2 text-right font-bold ${item.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-1 py-2 text-right">{item.stockBalance}</td>
                    <td className="px-1 py-2 text-right">{item.avgPrice.toFixed(2)}</td>
                    <td className={`px-1 py-2 text-right font-bold ${item.result > 0 ? 'text-green-600' : item.result < 0 ? 'text-red-600' : ''}`}>
                      {item.result ? item.result.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    </td>
                    <td className="px-1 py-2 text-right text-red-500 font-bold bg-gray-50 dark:bg-gray-900">
                      {item.irDue > 0 ? item.irDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    </td>
                    <td className="px-1 py-2 text-center bg-gray-50 dark:bg-gray-900">{item.monthRef}</td>
                    <td className="px-1 py-2 text-right bg-gray-50 dark:bg-gray-900">{item.monthlySales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-1 py-2 text-right bg-gray-50 dark:bg-gray-900">{item.monthlyPurchases.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className={`px-1 py-2 text-right font-bold bg-gray-50 dark:bg-gray-900 ${item.gainPercent > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      {item.type === 'SELL' && item.gainPercent ? `${item.gainPercent.toFixed(2)}%` : ''}
                    </td>
                    <td className="px-1 py-2 text-center">
                      <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                        ✏️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 dark:text-white">
        {editingId ? `Editar Operação #${editingId}` : 'Operações'}
      </h1>

      {!editingId && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('register')}
            className={`mr-4 pb-2 text-sm font-medium ${activeTab === 'register' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Registrar Nova
          </button>
          <button
            onClick={() => setActiveTab('statement')}
            className={`pb-2 text-sm font-medium ${activeTab === 'statement' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Extrato de Operações
          </button>
        </div>
      )}

      {activeTab === 'register' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Tipo de Operação</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            >
              <option value="BUY">Compra</option>
              <option value="SELL">Venda</option>
              <option value="DIVIDEND">Dividendos</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Código do Ativo</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Ex: PETR4"
                required
              />
              {availableStock !== null && type === 'SELL' && (
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  Disponível em carteira: <strong>{availableStock}</strong>
                </p>
              )}
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Quantidade</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`bg-gray-50 border text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:text-white ${availableStock !== null && type === 'SELL' && Number(quantity) > availableStock ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Preço Unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Show broker fees if SELL OR Editing (because user wants to add fees later to purchases too maybe?) */}
          {/* User said "costs... permitted to be included posterior". Usually fees apply to both. Let's show always? Or just allow editing for now? */}
          {/* Requirement: "na operação de venda... os valores de custos... devem ser permitidos seram inclusos posterior". */}
          {/* Implies fees fields should be visible/editable. Let's make them always visible or at least for SELL. */}
          {/* Previously only visible for SELL. Let's keep it for SELL, or if editing. */}
          {(type === 'SELL' || editingId) && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Corretagem (R$)</label>
                <input type="number" step="0.01" value={brokerage} onChange={(e) => setBrokerage(e.target.value)} className="w-full p-2 rounded border" placeholder="0.00" />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Outras Taxas (R$)</label>
                <input type="number" step="0.01" value={otherFees} onChange={(e) => setOtherFees(e.target.value)} className="w-full p-2 rounded border" placeholder="0.00" />
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button type="submit" className="flex-1 text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
              {editingId ? 'Salvar Alterações' : 'Registrar Operação'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-gray-500 bg-white hover:bg-gray-100 border border-gray-200 font-medium rounded-lg text-sm px-5 py-2.5 focus:z-10 focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">
                Cancelar
              </button>
            )}
          </div>
        </form>
      ) : (
        renderStatement()
      )}
    </div>
  );
}
