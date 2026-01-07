import { Brand, BrandConfig } from './types';

export const BRAND_CONFIGS: Record<Brand, BrandConfig> = {
  [Brand.SAMSUNG]: { label: 'Samsung', colorClass: 'bg-[#1428a0]', hex: '#1428a0', logoUrl: 'https://cdn.simpleicons.org/samsung/1428a0' },
  [Brand.APPLE]: { label: 'Apple', colorClass: 'bg-gray-800', hex: '#1f2937', logoUrl: 'https://cdn.simpleicons.org/apple/1f2937' },
  [Brand.OPPO]: { label: 'Oppo', colorClass: 'bg-emerald-600', hex: '#059669', logoUrl: 'https://cdn.simpleicons.org/oppo/059669' },
  [Brand.ZTE]: { label: 'ZTE', colorClass: 'bg-sky-500', hex: '#0ea5e9', logoUrl: 'https://cdn.simpleicons.org/zte/0ea5e9' },
  [Brand.MOTOROLA]: { label: 'Motorola', colorClass: 'bg-indigo-900', hex: '#312e81', logoUrl: 'https://cdn.simpleicons.org/motorola/312e81' },
  [Brand.REALME]: { label: 'Realme', colorClass: 'bg-yellow-400 text-black', hex: '#facc15', logoUrl: 'https://cdn.simpleicons.org/realme/facc15' },
  [Brand.VIVO]: { label: 'Vivo', colorClass: 'bg-blue-600', hex: '#2563eb', logoUrl: 'https://cdn.simpleicons.org/vivo/2563eb' },
  [Brand.XIAOMI]: { label: 'Xiaomi', colorClass: 'bg-orange-500', hex: '#f97316', logoUrl: 'https://cdn.simpleicons.org/xiaomi/f97316' },
  [Brand.HONOR]: { label: 'Honor', colorClass: 'bg-cyan-400 text-black', hex: '#22d3ee', logoUrl: 'https://cdn.simpleicons.org/honor/22d3ee' },
  [Brand.HUAWEI]: { label: 'Huawei', colorClass: 'bg-red-600', hex: '#dc2626', logoUrl: 'https://cdn.simpleicons.org/huawei/dc2626' },
  [Brand.SENWA]: { label: 'Senwa', colorClass: 'bg-purple-700', hex: '#7e22ce' }, // Fallback to color dot
  [Brand.NUBIA]: { label: 'Nubia', colorClass: 'bg-rose-600', hex: '#e11d48' }, // Fallback to color dot
  [Brand.OTRO]: { label: 'Otro', colorClass: 'bg-slate-500', hex: '#64748b' }, // Fallback to color dot
};

export const DEFAULT_SALE_FORM = {
  invoiceNumber: '',
  customerName: '',
  price: '',
  brand: Brand.SAMSUNG,
  date: new Date().toISOString().split('T')[0],
  ticketImage: null as string | null
};