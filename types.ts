export enum Brand {
  SAMSUNG = 'SAMSUNG',
  APPLE = 'APPLE',
  OPPO = 'OPPO',
  ZTE = 'ZTE',
  MOTOROLA = 'MOTOROLA',
  REALME = 'REALME',
  VIVO = 'VIVO',
  XIAOMI = 'XIAOMI',
  HONOR = 'HONOR',
  HUAWEI = 'HUAWEI',
  SENWA = 'SENWA',
  NUBIA = 'NUBIA',
  OTRO = 'OTRO'
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerName: string;
  price: number;
  brand: Brand;
  date: string;
  ticketImage?: string; // Base64 string
  createdBy?: string; // UUID of user
}

export interface BrandConfig {
  label: string;
  colorClass: string;
  hex: string;
  logoUrl?: string;
}

export interface TicketAnalysisResult {
  invoiceNumber?: string;
  price?: number;
  date?: string;
  brand?: Brand;
  customerName?: string;
}

export interface DailyClose {
  id: string;
  date: string;
  totalSales: number;
  totalRevenue: number;
  closedAt: string;
  topBrand: Brand | 'N/A';
}

export type UserRole = 'admin' | 'seller';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
}

export interface MonthlyGoal {
  month: string; // YYYY-MM
  revenue_goal: number;
  devices_goal: number;
}