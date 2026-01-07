import { Brand, BrandConfig } from './types';

export const BRAND_CONFIGS: Record<Brand, BrandConfig> = {
  [Brand.SAMSUNG]: { label: 'Samsung', colorClass: 'bg-[#1428a0]', hex: '#1428a0', logoUrl: 'https://cdn.simpleicons.org/samsung/1428a0' },
  [Brand.APPLE]: { label: 'Apple', colorClass: 'bg-gray-800', hex: '#000000', logoUrl: 'https://cdn.simpleicons.org/apple/000000' },
  [Brand.OPPO]: { label: 'Oppo', colorClass: 'bg-emerald-600', hex: '#009B77', logoUrl: 'https://cdn.simpleicons.org/oppo/009B77' }, // Official Oppo Green
  [Brand.ZTE]: { label: 'ZTE', colorClass: 'bg-sky-500', hex: '#2C8CDB', logoUrl: 'https://cdn.simpleicons.org/zte/2C8CDB' }, // Official Blue
  [Brand.MOTOROLA]: { label: 'Motorola', colorClass: 'bg-indigo-900', hex: '#5C6BC0', logoUrl: 'https://cdn.simpleicons.org/motorola/5C6BC0' }, // Distinct from Samsung
  [Brand.REALME]: { label: 'Realme', colorClass: 'bg-yellow-400 text-black', hex: '#FFC700', logoUrl: 'https://cdn.simpleicons.org/realme/FFC700' },
  [Brand.VIVO]: { label: 'Vivo', colorClass: 'bg-blue-600', hex: '#415FFF', logoUrl: 'https://cdn.simpleicons.org/vivo/415FFF' }, // Vivo Blue
  [Brand.XIAOMI]: { label: 'Xiaomi', colorClass: 'bg-orange-500', hex: '#FF6900', logoUrl: 'https://cdn.simpleicons.org/xiaomi/FF6900' }, // Xiaomi Orange
  [Brand.HONOR]: { label: 'Honor', colorClass: 'bg-cyan-400 text-black', hex: '#00E3E3', logoUrl: 'https://cdn.simpleicons.org/honor/00E3E3' }, // Honor Cyan
  [Brand.HUAWEI]: { label: 'Huawei', colorClass: 'bg-red-600', hex: '#C7000B', logoUrl: 'https://cdn.simpleicons.org/huawei/C7000B' }, // Official Red
  [Brand.SENWA]: { label: 'Senwa', colorClass: 'bg-purple-700', hex: '#7E22CE' }, // Purple for distinction
  [Brand.NUBIA]: { label: 'Nubia', colorClass: 'bg-rose-600', hex: '#BE123C' }, // Ruby
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