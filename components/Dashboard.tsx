import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Target, Edit2, Check, TrendingUp, Trophy, PartyPopper, DollarSign, Smartphone } from 'lucide-react';
import { Sale, Brand, DailyClose } from '../types';
import { BRAND_CONFIGS } from '../constants';
import { supabase } from '../services/supabaseClient';
import { Trash2 } from 'lucide-react';

interface DashboardProps {
  sales: Sale[];
  role?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ sales, role }) => {
  const handleFactoryReset = async () => {
    if (window.confirm("⚠️ ¿ESTÁS SEGURO? \n\nEsto borrará TODAS las ventas y EL HISTORIAL DE CIERRES de la base de datos permanentemente.\n\nLa aplicación quedará vacía como nueva.")) {
      const confirm2 = window.prompt("Escribe 'BORRAR' para confirmar la acción:");
      if (confirm2 === 'BORRAR') {
        try {
          // Delete all sales
          const { error: errorSales } = await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (errorSales) throw errorSales;

          // Delete all closings
          const { error: errorClosings } = await supabase.from('daily_closings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (errorClosings) throw errorClosings;

          // Clear Local Storage
          localStorage.clear();

          alert("Aplicación restablecida: Historial de Ventas y Cierres eliminados correctamente.");
          window.location.reload();
        } catch (error: any) {
          console.error("Error reset:", error);
          alert("Error al restablecer: " + error.message);
        }
      }
    }
  };

  // --- REVENUE GOAL STATE ---
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('monthly_sales_goal');
    return saved ? parseFloat(saved) : 100000;
  });
  const [goalMonth, setGoalMonth] = useState<string>(() => {
    return localStorage.getItem('monthly_sales_goal_month') || '';
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(monthlyGoal.toString());

  // --- DEVICE COUNT GOAL STATE ---
  const [devicesGoal, setDevicesGoal] = useState<number>(() => {
    const saved = localStorage.getItem('monthly_devices_goal');
    return saved ? parseInt(saved) : 50;
  });
  const [devicesGoalMonth, setDevicesGoalMonth] = useState<string>(() => {
    return localStorage.getItem('monthly_devices_goal_month') || '';
  });
  const [isEditingDevices, setIsEditingDevices] = useState(false);
  const [tempDevicesGoal, setTempDevicesGoal] = useState(devicesGoal.toString());

  // --- CALCULATIONS ---
  // 1. Historical Totals (Keep existing for bottom cards)
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.price, 0);
  const totalSalesCount = sales.length; // Renamed to avoid confusion

  // 2. Current Month Totals (For Goals)
  const todayDate = new Date();
  const currentMonthPrefix = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthSales = sales.filter(s => s.date.startsWith(currentMonthPrefix));
  const currentMonthRevenue = currentMonthSales.reduce((sum, sale) => sum + sale.price, 0);
  const currentMonthCount = currentMonthSales.length;
  const currentMonthNet = currentMonthRevenue / 1.16;

  // Check if goals are locked for the current month
  const isGoalLocked = goalMonth === currentMonthPrefix;
  const isDevicesGoalLocked = devicesGoalMonth === currentMonthPrefix;

  // Revenue Progress (Monthly)
  const revenueProgress = Math.min((currentMonthNet / monthlyGoal) * 100, 100);
  const revenueRemaining = Math.max(monthlyGoal - currentMonthNet, 0);
  const isRevenueGoalMet = currentMonthNet >= monthlyGoal;

  // Devices Progress (Monthly)
  const devicesProgress = Math.min((currentMonthCount / devicesGoal) * 100, 100);
  const devicesRemaining = Math.max(devicesGoal - currentMonthCount, 0);
  const isDevicesGoalMet = currentMonthCount >= devicesGoal;

  // Circular Chart Helpers
  // We use a viewBox of 0 0 100 100. Center is 50,50.
  // Radius 40 leaves 10 units of padding on each side for the stroke width.
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffsetRevenue = circumference - (revenueProgress / 100) * circumference;
  const strokeDashoffsetDevices = circumference - (devicesProgress / 100) * circumference;

  // --- HANDLERS ---
  const handleSaveGoal = () => {
    const val = parseFloat(tempGoal);
    if (!isNaN(val) && val > 0) {
      setMonthlyGoal(val);
      setGoalMonth(currentMonthPrefix);
      localStorage.setItem('monthly_sales_goal', val.toString());
      localStorage.setItem('monthly_sales_goal_month', currentMonthPrefix);
      setIsEditingGoal(false);
    }
  };

  const handleSaveDevicesGoal = () => {
    const val = parseInt(tempDevicesGoal);
    if (!isNaN(val) && val > 0) {
      setDevicesGoal(val);
      setDevicesGoalMonth(currentMonthPrefix);
      localStorage.setItem('monthly_devices_goal', val.toString());
      localStorage.setItem('monthly_devices_goal_month', currentMonthPrefix);
      setIsEditingDevices(false);
    }
  };

  // --- CHARTS DATA ---
  const brandData = Object.values(Brand).map(brand => {
    const brandSales = sales.filter(s => s.brand === brand);
    return {
      name: BRAND_CONFIGS[brand].label,
      value: brandSales.length,
      color: BRAND_CONFIGS[brand].hex,
      revenue: brandSales.reduce((sum, s) => sum + s.price, 0)
    };
  }).filter(item => item.value > 0);

  const today = new Date();
  const timelineData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dailySales = sales.filter(s => s.date === dateStr);
    return {
      date: dateStr,
      amount: dailySales.reduce((sum, s) => sum + s.price, 0),
      count: dailySales.length
    };
  });

  return (
    <div className="space-y-6">


      {/* SUCCESS NOTIFICATION BANNER (Unified) */}
      {(isRevenueGoalMet || isDevicesGoalMet) && (
        <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white p-6 rounded-2xl shadow-lg transform transition-all hover:scale-[1.01] animate-in fade-in slide-in-from-top-4 duration-700 relative overflow-hidden border border-orange-400/50">
          <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
            <PartyPopper className="w-40 h-40 transform rotate-12" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm shadow-inner shrink-0">
              <Trophy className="w-12 h-12 text-yellow-100" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold mb-1 drop-shadow-sm">¡Objetivo Cumplido! 🎉</h2>
              <p className="text-orange-50 font-medium text-lg leading-snug">
                {isRevenueGoalMet && isDevicesGoalMet
                  ? "¡Increíble! Has superado AMBAS metas mensuales. Tu rendimiento es excepcional."
                  : isRevenueGoalMet
                    ? `Has superado tu meta de ingresos de $${monthlyGoal.toLocaleString('es-MX')}.`
                    : `Has vendido más de ${devicesGoal} equipos este mes.`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* GOALS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CARD 1: REVENUE GOAL */}
        <div className="bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden text-white group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600 rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity"></div>

          <div className="relative z-10 flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Meta de Ingresos</h2>
                <p className="text-xs text-slate-400 font-medium">Venta neta Mensual (Sin IVA)</p>
              </div>
            </div>
            {role === 'admin' && !isEditingGoal && (
              isGoalLocked ? (
                <div className="group/tooltip relative">
                  <button disabled className="p-2 text-slate-600 cursor-not-allowed rounded-full"><Edit2 className="w-4 h-4" /></button>
                  <span className="absolute -top-8 right-0 bg-slate-800 text-xs px-2 py-1 rounded text-white opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap">Meta fijada por este mes</span>
                </div>
              ) : (
                <button onClick={() => { setTempGoal(monthlyGoal.toString()); setIsEditingGoal(true); }} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"><Edit2 className="w-4 h-4" /></button>
              )
            )}
          </div>

          <div className="relative z-10 flex items-end justify-between gap-4">
            <div className="space-y-2 flex-1">
              {isEditingGoal ? (
                <div className="flex items-center gap-2">
                  <input type="number" value={tempGoal} onChange={(e) => setTempGoal(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg text-white font-bold p-2 outline-none" autoFocus />
                  <button onClick={handleSaveGoal} className="p-2 bg-blue-600 rounded-lg"><Check className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                    ${currentMonthNet.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs text-slate-400">Meta: ${monthlyGoal.toLocaleString('es-MX')}</span>
                </div>
              )}

              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
                <div className={`h-full rounded-full transition-all duration-1000 ${isRevenueGoalMet ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} style={{ width: `${revenueProgress}%` }}></div>
              </div>
              <p className="text-xs text-slate-400 pt-1">{revenueRemaining > 0 ? `Faltan $${revenueRemaining.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : '¡Meta Superada!'}</p>
            </div>

            {/* Circular Indicator */}
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffsetRevenue} strokeLinecap="round" className={`transition-all duration-1000 ${isRevenueGoalMet ? 'text-green-500' : 'text-blue-500'}`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{revenueProgress.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        {/* CARD 2: DEVICES GOAL */}
        <div className="bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden text-white group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-600 rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity"></div>

          <div className="relative z-10 flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                <Smartphone className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Meta de Equipos</h2>
                <p className="text-xs text-slate-400 font-medium">Unidades vendidas Mensual</p>
              </div>
            </div>
            {role === 'admin' && !isEditingDevices && (
              isDevicesGoalLocked ? (
                <div className="group/tooltip relative">
                  <button disabled className="p-2 text-slate-600 cursor-not-allowed rounded-full"><Edit2 className="w-4 h-4" /></button>
                  <span className="absolute -top-8 right-0 bg-slate-800 text-xs px-2 py-1 rounded text-white opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap">Meta fijada por este mes</span>
                </div>
              ) : (
                <button onClick={() => { setTempDevicesGoal(devicesGoal.toString()); setIsEditingDevices(true); }} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"><Edit2 className="w-4 h-4" /></button>
              )
            )}
          </div>

          <div className="relative z-10 flex items-end justify-between gap-4">
            <div className="space-y-2 flex-1">
              {isEditingDevices ? (
                <div className="flex items-center gap-2">
                  <input type="number" value={tempDevicesGoal} onChange={(e) => setTempDevicesGoal(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg text-white font-bold p-2 outline-none" autoFocus />
                  <button onClick={handleSaveDevicesGoal} className="p-2 bg-emerald-600 rounded-lg"><Check className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                    {currentMonthCount} <span className="text-lg font-medium text-slate-400">unidades</span>
                  </span>
                  <span className="text-xs text-slate-400">Meta: {devicesGoal} equipos</span>
                </div>
              )}

              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
                <div className={`h-full rounded-full transition-all duration-1000 ${isDevicesGoalMet ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-emerald-500 to-cyan-500'}`} style={{ width: `${devicesProgress}%` }}></div>
              </div>
              <p className="text-xs text-slate-400 pt-1">{devicesRemaining > 0 ? `Faltan ${devicesRemaining} equipos` : '¡Meta Superada!'}</p>
            </div>

            {/* Circular Indicator */}
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffsetDevices} strokeLinecap="round" className={`transition-all duration-1000 ${isDevicesGoalMet ? 'text-green-500' : 'text-emerald-500'}`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{devicesProgress.toFixed(0)}%</div>
            </div>
          </div>
        </div>

      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-slate-500 text-sm font-bold">Venta Bruta Total (Histórico)</p>
          </div>
          <h3 className="text-2xl font-bold text-slate-800">${totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
          <p className="text-xs text-slate-400 mt-1">IVA Incluido</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-slate-500 text-sm font-bold">Equipos Vendidos (Histórico)</p>
          </div>
          <h3 className="text-2xl font-bold text-slate-800">{totalSalesCount}</h3>
          <p className="text-xs text-slate-400 mt-1">Dispositivos móviles</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Trophy className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-slate-500 text-sm font-bold">Marca Líder</p>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 truncate">
            {brandData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Mayor volumen de ventas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Distribution Chart (Count) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Distribución por Marca (Cantidad)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={brandData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {brandData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [`${value} ventas`, 'Cantidad']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Brand Revenue Chart (Amount) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Ingresos por Marca</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={brandData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="revenue"
              >
                {brandData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [`$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Ingreso']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sales Trend Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px] lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Ingresos (Últimos 7 días)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(val) => val.slice(5)} // Show MM-DD
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [`$${value}`, 'Ingreso']}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* DANGER ZONE */}
      <div className="flex justify-center pt-8 pb-4">
        <button
          onClick={handleFactoryReset}
          className="flex items-center gap-2 text-slate-400 hover:text-red-600 transition-colors text-xs font-bold px-4 py-2 hover:bg-red-50 rounded-lg group"
        >
          <Trash2 className="w-4 h-4 group-hover:animate-pulse" />
          Restablecer Aplicación (Danger Zone)
        </button>
      </div>
    </div >
  );
};

export default Dashboard;