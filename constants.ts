import { Brand, BrandConfig } from './types';

export const BRAND_CONFIGS: Record<Brand, BrandConfig> = {
  [Brand.SAMSUNG]: { label: 'Samsung', colorClass: 'bg-[#1428a0]', hex: '#1428a0' },
  [Brand.APPLE]: { label: 'Apple', colorClass: 'bg-gray-800', hex: '#1f2937' },
  [Brand.OPPO]: { label: 'Oppo', colorClass: 'bg-emerald-600', hex: '#059669' },
  [Brand.ZTE]: { label: 'ZTE', colorClass: 'bg-sky-500', hex: '#0ea5e9' },
  [Brand.MOTOROLA]: { label: 'Motorola', colorClass: 'bg-indigo-900', hex: '#312e81' },
  [Brand.REALME]: { label: 'Realme', colorClass: 'bg-yellow-400 text-black', hex: '#facc15' },
  [Brand.VIVO]: { label: 'Vivo', colorClass: 'bg-blue-600', hex: '#2563eb' },
  [Brand.XIAOMI]: { label: 'Xiaomi', colorClass: 'bg-orange-500', hex: '#f97316' },
  [Brand.HONOR]: { label: 'Honor', colorClass: 'bg-cyan-400 text-black', hex: '#22d3ee' },
  [Brand.HUAWEI]: { label: 'Huawei', colorClass: 'bg-red-600', hex: '#dc2626' },
  [Brand.SENWA]: { label: 'Senwa', colorClass: 'bg-purple-700', hex: '#7e22ce' },
  [Brand.OTRO]: { label: 'Otro', colorClass: 'bg-slate-500', hex: '#64748b' },
};

export const DEFAULT_SALE_FORM = {
  invoiceNumber: '',
  customerName: '',
  price: '',
  brand: Brand.SAMSUNG,
  date: new Date().toISOString().split('T')[0],
  ticketImage: null as string | null
};