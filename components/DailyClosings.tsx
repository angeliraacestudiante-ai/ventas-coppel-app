import React, { useState, useMemo } from 'react';
import { CalendarCheck, DollarSign, ShoppingBag, Clock, ChevronDown, ChevronUp, Lock, Receipt, X, User, Tag, Calendar, Image as ImageIcon, CalendarRange, Layers, Filter, XCircle, ArrowRight, Share2 } from 'lucide-react';
import { Sale, DailyClose, Brand } from '../types';
import { BRAND_CONFIGS } from '../constants';

interface DailyClosingsProps {
  sales: Sale[];
  closings: DailyClose[];
  onCloseDay: (close: DailyClose) => void;
}

const DailyClosings: React.FC<DailyClosingsProps> = ({ sales, closings, onCloseDay }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedMonthKey, setExpandedMonthKey] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedDaySummary, setSelectedDaySummary] = useState<{ date: string, sales: Sale[] } | null>(null);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  // Construct YYYY-MM-DD in local time manually
  const localDate = new Date();
  const todayStr = localDate.getFullYear() + '-' +
    String(localDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(localDate.getDate()).padStart(2, '0');

  // Calculate today's stats live
  const todaysSales = sales.filter(s => s.date === todayStr);
  const todayRevenue = todaysSales.reduce((sum, s) => sum + s.price, 0);
  const todayCount = todaysSales.length;

  // Find top brand for today
  const brandCounts = todaysSales.reduce((acc, sale) => {
    acc[sale.brand] = (acc[sale.brand] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topBrandToday = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as Brand | undefined;

  // --- FILTER LOGIC ---
  const filteredClosings = useMemo(() => {
    return closings.filter(close => {
      const closeDate = close.date;
      if (dateFilter.start && closeDate < dateFilter.start) return false;
      if (dateFilter.end && closeDate > dateFilter.end) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [closings, dateFilter]);

  // --- MONTHLY DATA CALCULATION (Based on Filtered Data) ---
  const monthlyData = useMemo(() => {
    const groups: Record<string, {
      monthKey: string;
      label: string;
      totalRevenue: number;
      totalSales: number;
      closings: DailyClose[];
      year: number;
      monthIndex: number;
    }> = {};

    filteredClosings.forEach(close => {
      const date = new Date(close.date);
      // Adjust timezone issues by treating the date string as local parts
      const [year, month] = close.date.split('-').map(Number);
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

      if (!groups[monthKey]) {
        // Create label (e.g., "Noviembre 2023")
        const dateObj = new Date(year, month - 1, 1);
        const label = dateObj.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

        groups[monthKey] = {
          monthKey,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          totalRevenue: 0,
          totalSales: 0,
          closings: [],
          year,
          monthIndex: month - 1
        };
      }

      groups[monthKey].totalRevenue += close.totalRevenue;
      groups[monthKey].totalSales += close.totalSales;
      groups[monthKey].closings.push(close);
    });

    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.monthIndex - a.monthIndex;
    });
  }, [filteredClosings]);

  // Helper to get top brand for a whole month
  const getMonthTopBrand = (monthKey: string) => {
    const monthSales = sales.filter(s => {
      const matchesMonth = s.date.startsWith(monthKey);
      if (!matchesMonth) return false;
      if (dateFilter.start && s.date < dateFilter.start) return false;
      if (dateFilter.end && s.date > dateFilter.end) return false;
      return true;
    });

    if (monthSales.length === 0) return null;

    const counts = monthSales.reduce((acc, s) => {
      acc[s.brand] = (acc[s.brand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? (top[0] as Brand) : null;
  };

  const handlePerformClose = () => {
    if (todayCount === 0) {
      alert("No hay ventas registradas para el día de hoy.");
      return;
    }

    const topBrandCount = topBrandToday ? brandCounts[topBrandToday] : 0;
    const topBrandName = topBrandToday ? BRAND_CONFIGS[topBrandToday].label : 'N/A';

    if (window.confirm("¿Estás seguro de que deseas realizar el corte del día?")) {
      const newClose: DailyClose = {
        id: crypto.randomUUID(),
        date: todayStr,
        totalSales: todayCount,
        totalRevenue: todayRevenue,
        closedAt: new Date().toISOString(),
        topBrand: topBrandToday || 'N/A' as any
      };
      onCloseDay(newClose);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const toggleMonthExpand = (key: string) => {
    setExpandedMonthKey(prev => prev === key ? null : key);
  };

  const clearFilters = () => {
    setDateFilter({ start: '', end: '' });
  };

  const hasActiveFilter = dateFilter.start || dateFilter.end;

  return (
    <div className="space-y-8 pb-12">

      {/* Current Day Panel */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-xl overflow-hidden text-white relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>

        <div className="p-6 md:p-8 relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <CalendarCheck className="w-6 h-6 text-blue-400" />
                Cierre del Día
              </h2>
              <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <span className="bg-blue-600/30 border border-blue-500/50 text-blue-100 px-3 py-1 rounded-full text-xs font-mono font-bold">
              HOY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/5">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Ventas Hoy</p>
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-400" />
                <span className="text-3xl font-bold">{todayCount}</span>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/5">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Ingreso Total</p>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="text-3xl font-bold">
                  ${todayRevenue.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/5">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Top Marca</p>
              {topBrandToday ? (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg ${BRAND_CONFIGS[topBrandToday].colorClass}`}
                  style={BRAND_CONFIGS[topBrandToday].colorClass.includes('text-black') ? { color: 'black' } : {}}
                >
                  {BRAND_CONFIGS[topBrandToday].label}
                </span>
              ) : (
                <span className="text-slate-500 font-medium text-sm">Sin datos</span>
              )}
            </div>
          </div>

          <button
            onClick={handlePerformClose}
            disabled={todayCount === 0}
            className={`
              w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg
              ${todayCount > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/50 hover:shadow-blue-900/70 hover:-translate-y-0.5'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
            `}
          >
            <Lock className="w-4 h-4" />
            Realizar Corte del Día
          </button>
        </div>
      </div>

      {/* Controls: Filter & Tabs */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'daily'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
          >
            <Clock className="w-4 h-4" />
            Diario
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'monthly'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
          >
            <CalendarRange className="w-4 h-4" />
            Mensual
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto p-2 md:p-0">
          <div className="flex items-center gap-2 text-sm w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              className="w-full md:w-32 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <ArrowRight className="w-3 h-3 text-slate-300" />
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              className="w-full md:w-32 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          {hasActiveFilter && (
            <button onClick={clearFilters} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Limpiar filtro">
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* MAIN LIST CONTENT */}
      <div className="space-y-4">
        {activeTab === 'daily' ? (
          /* --- DAILY VIEW --- */
          <>
            {filteredClosings.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                <Layers className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No se encontraron cierres registrados.</p>
              </div>
            ) : (
              filteredClosings.map((close) => {
                const isExpanded = expandedId === close.id;
                // Fix timezone issue by parsing parts manually
                const [cYear, cMonth, cDay] = close.date.split('-').map(Number);
                const dateObj = new Date(cYear, cMonth - 1, cDay);
                const daySales = sales.filter(s => s.date === close.date);

                return (
                  <div key={close.id} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden group ${isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-100' : 'border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100'}`}>

                    {/* Header Row */}
                    <div
                      onClick={() => toggleExpand(close.id)}
                      className="p-5 flex flex-col md:flex-row items-stretch md:items-center gap-6 cursor-pointer"
                    >
                      {/* Date Badge */}
                      <div className="flex flex-row md:flex-col items-center justify-center md:w-20 md:h-20 bg-blue-50/50 rounded-xl border border-blue-100 text-blue-700 shrink-0 gap-3 md:gap-0 p-3 md:p-0">
                        <span className="text-2xl md:text-3xl font-black leading-none">{dateObj.getDate()}</span>
                        <span className="text-sm font-bold uppercase tracking-wider">{dateObj.toLocaleDateString('es-MX', { month: 'short' })}</span>
                        <span className="md:hidden text-slate-400 font-normal text-sm ml-auto">{dateObj.getFullYear()}</span>
                      </div>

                      {/* Info Grid */}
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-4 items-center">
                        <div className="col-span-2 md:col-span-1">
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Día</p>
                          <p className="font-semibold text-slate-800 capitalize">{dateObj.toLocaleDateString('es-MX', { weekday: 'long' })}</p>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(close.closedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Ventas</p>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="font-bold text-slate-700">{close.totalSales}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Ingresos</p>
                          <span className="font-bold text-slate-900 bg-green-50 text-green-700 px-2 py-0.5 rounded-lg border border-green-100">
                            ${close.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Sin IVA</p>
                          <span className="font-bold text-slate-700 text-sm">
                            ${(close.totalRevenue / 1.16).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="hidden md:block text-right">
                          {close.topBrand !== 'N/A' && BRAND_CONFIGS[close.topBrand as Brand] && (
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wide ${BRAND_CONFIGS[close.topBrand as Brand].colorClass}`}
                              style={BRAND_CONFIGS[close.topBrand as Brand].colorClass.includes('text-black') ? { color: 'black' } : {}}
                            >
                              {BRAND_CONFIGS[close.topBrand as Brand].label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chevron */}
                      <div className={`text-slate-300 md:ml-4 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-500' : 'group-hover:text-slate-400'}`}>
                        <ChevronDown className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 md:p-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3 border-b border-slate-100">Factura</th>
                                <th className="px-4 py-3 border-b border-slate-100">Cliente</th>
                                <th className="px-4 py-3 border-b border-slate-100">Marca</th>
                                <th className="px-4 py-3 border-b border-slate-100 text-right">Precio</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {daySales.map(sale => (
                                <tr
                                  key={sale.id}
                                  onClick={() => setSelectedSale(sale)}
                                  className="hover:bg-blue-50/50 transition-colors cursor-pointer group/row"
                                >
                                  <td className="px-4 py-3 font-mono text-slate-500 group-hover/row:text-blue-600 flex items-center gap-2">
                                    {sale.ticketImage ? <ImageIcon className="w-3 h-3 text-blue-400" /> : <span className="w-3 inline-block"></span>}
                                    {sale.invoiceNumber}
                                  </td>
                                  <td className="px-4 py-3 text-slate-700 font-medium">{sale.customerName}</td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm ${BRAND_CONFIGS[sale.brand].colorClass}`}
                                      style={BRAND_CONFIGS[sale.brand].colorClass.includes('text-black') ? { color: 'black' } : {}}
                                    >
                                      {BRAND_CONFIGS[sale.brand].label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-slate-700">
                                    ${sale.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        ) : (
          /* --- MONTHLY VIEW --- */
          <>
            {monthlyData.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                <CalendarRange className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No hay datos mensuales disponibles.</p>
              </div>
            ) : (
              monthlyData.map(month => {
                const isExpanded = expandedMonthKey === month.monthKey;
                const monthTopBrand = getMonthTopBrand(month.monthKey);

                return (
                  <div key={month.monthKey} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden group ${isExpanded ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100'}`}>

                    <div
                      onClick={() => toggleMonthExpand(month.monthKey)}
                      className="p-5 flex flex-col md:flex-row items-stretch md:items-center gap-6 cursor-pointer bg-gradient-to-r from-transparent to-transparent hover:from-indigo-50/30"
                    >
                      {/* Month Badge */}
                      <div className="flex flex-row md:flex-col items-center justify-center md:w-20 md:h-20 bg-indigo-50/50 rounded-xl border border-indigo-100 text-indigo-700 shrink-0 gap-3 md:gap-0 p-3 md:p-0">
                        <span className="text-xl md:text-2xl font-black uppercase">{month.label.substring(0, 3)}</span>
                        <span className="text-xs font-bold text-indigo-400">{month.year}</span>
                      </div>

                      {/* Info Grid */}
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-4 items-center">
                        <div className="col-span-2 md:col-span-1">
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Periodo</p>
                          <p className="font-semibold text-slate-800">{month.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{month.closings.length} cortes realizados</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Ventas</p>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span className="font-bold text-slate-700">{month.totalSales}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Ingresos</p>
                          <span className="font-bold text-slate-900 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-100">
                            ${month.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Sin IVA</p>
                          <span className="font-bold text-slate-700 text-sm">
                            ${(month.totalRevenue / 1.16).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="hidden md:block text-right">
                          {monthTopBrand ? (
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wide ${BRAND_CONFIGS[monthTopBrand].colorClass}`}
                              style={BRAND_CONFIGS[monthTopBrand].colorClass.includes('text-black') ? { color: 'black' } : {}}
                            >
                              {BRAND_CONFIGS[monthTopBrand].label}
                            </span>
                          ) : <span className="text-slate-300">-</span>}
                        </div>
                      </div>

                      <div className={`text-slate-300 md:ml-4 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-500' : 'group-hover:text-slate-400'}`}>
                        <ChevronDown className="w-6 h-6" />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 md:p-6 animate-in slide-in-from-top-2 duration-300">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          Desglose Diario
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {month.closings.map(close => (
                            <div
                              key={close.id}
                              onClick={() => {
                                const daySales = sales.filter(s => s.date === close.date);
                                setSelectedDaySummary({ date: close.date, sales: daySales });
                              }}
                              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all group/day"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover/day:bg-blue-100 flex items-center justify-center font-bold text-slate-600 group-hover/day:text-blue-600 text-sm transition-colors">
                                  {(() => {
                                    const [dYear, dMonth, dDay] = close.date.split('-').map(Number);
                                    return dDay;
                                  })()}
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-slate-800 group-hover/day:text-blue-700">
                                    {(() => {
                                      const [dYear, dMonth, dDay] = close.date.split('-').map(Number);
                                      const dDate = new Date(dYear, dMonth - 1, dDay);
                                      return dDate.toLocaleDateString('es-MX', { weekday: 'long' });
                                    })()}
                                  </p>
                                  <p className="text-xs text-slate-500">{close.totalSales} ventas</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600 text-sm">${close.totalRevenue.toLocaleString('es-MX')}</p>
                                <p className="text-[10px] text-slate-400 font-medium group-hover/day:text-blue-500">Ver Detalles &rarr;</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* SALE DETAIL MODAL */}
      {selectedSale && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedSale(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                Ticket Digital
              </h3>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto">
              <div className="text-center mb-6">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Total Pagado</p>
                <p className="text-4xl font-black text-slate-800 tracking-tight">
                  ${selectedSale.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-500">
                  <span className={`w-2 h-2 rounded-full ${BRAND_CONFIGS[selectedSale.brand].colorClass.split(' ')[0]} bg-current`} style={{ color: BRAND_CONFIGS[selectedSale.brand].hex }}></span>
                  {BRAND_CONFIGS[selectedSale.brand].label}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200/50">
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <User className="w-4 h-4" />
                    <span>Cliente</span>
                  </div>
                  <span className="font-semibold text-slate-800">{selectedSale.customerName}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-200/50">
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Tag className="w-4 h-4" />
                    <span>Factura</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">{selectedSale.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>Fecha</span>
                  </div>
                  <span className="font-semibold text-slate-800">{selectedSale.date}</span>
                </div>
              </div>

              {selectedSale.ticketImage && (
                <div className="mt-6">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                      Evidencia Adjunta
                    </div>
                    {selectedSale.ticketImage && (selectedSale.ticketImage.includes('http') || selectedSale.ticketImage.includes('google')) && (
                      <button
                        onClick={() => {
                          const url = selectedSale.ticketImage!;
                          if (navigator.share) {
                            navigator.share({
                              title: `Ticket - ${selectedSale.invoiceNumber}`,
                              text: `Ticket de venta para ${selectedSale.customerName}`,
                              url: url
                            }).catch(console.error);
                          } else {
                            navigator.clipboard.writeText(url);
                            alert("Enlace copiado al portapapeles");
                          }
                        }}
                        className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg transition-colors"
                        title="Compartir Imagen"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}
                  </h4>
                  <div className="bg-slate-100 rounded-xl overflow-hidden p-1">
                    {selectedSale.ticketImage.includes('google.com') || selectedSale.ticketImage.includes('drive.google') ? (
                      <iframe
                        src={selectedSale.ticketImage.replace('uc?export=view&id=', 'file/d/').replace('/view', '/preview').includes('/preview')
                          ? selectedSale.ticketImage
                          : selectedSale.ticketImage.includes('file/d/')
                            ? selectedSale.ticketImage.split('/view')[0] + '/preview'
                            : `https://drive.google.com/file/d/${selectedSale.ticketImage.split('id=')[1] || ''}/preview`}
                        className="w-full h-64 md:h-96 rounded-lg object-contain bg-white"
                        allow="autoplay"
                        title="Ticket Preview"
                      ></iframe>
                    ) : (
                      <img
                        src={selectedSale.ticketImage}
                        alt="Ticket"
                        className="w-full h-auto object-contain rounded-lg"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DAY SUMMARY MODAL FROM MONTH VIEW */}
      {selectedDaySummary && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedDaySummary(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Resumen del Día
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {new Date(selectedDaySummary.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setSelectedDaySummary(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-0 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 border-b border-slate-200 bg-slate-50">Factura</th>
                    <th className="px-6 py-3 border-b border-slate-200 bg-slate-50">Cliente</th>
                    <th className="px-6 py-3 border-b border-slate-200 bg-slate-50">Marca</th>
                    <th className="px-6 py-3 border-b border-slate-200 bg-slate-50 text-right">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedDaySummary.sales.map(sale => (
                    <tr
                      key={sale.id}
                      onClick={() => {
                        setSelectedSale(sale);
                        // Optional: Keep day summary open or close it? Keeping it open makes sense as parent context.
                        // But z-index handling might be needed. selectedSale modal has z-[60], this one z-[55], so it works.
                      }}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group/row"
                    >
                      <td className="px-6 py-4 font-mono text-slate-500 group-hover/row:text-blue-600 font-medium">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-medium">{sale.customerName}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm ${BRAND_CONFIGS[sale.brand].colorClass}`}
                          style={BRAND_CONFIGS[sale.brand].colorClass.includes('text-black') ? { color: 'black' } : {}}
                        >
                          {BRAND_CONFIGS[sale.brand].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-700">
                        ${sale.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {selectedDaySummary.sales.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                        No hay ventas individuales registradas en este corte.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-800">
                  <tr>
                    <td colSpan={3} className="px-6 py-3 text-right text-xs uppercase tracking-wider text-slate-500">Total del Día</td>
                    <td className="px-6 py-3 text-right text-green-600">
                      ${selectedDaySummary.sales.reduce((sum, s) => sum + s.price, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyClosings;