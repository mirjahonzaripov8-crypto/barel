export function formatNumber(n: number): string {
  return n.toLocaleString('uz-UZ');
}

export function formatCurrency(n: number): string {
  return `${formatNumber(n)} so'm`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('uz-UZ');
}

export function getDateRange(from: string, to: string) {
  return { from: new Date(from), to: new Date(to) };
}

export function isInRange(dateStr: string, from: string, to: string): boolean {
  const d = new Date(dateStr);
  const f = new Date(from);
  const t = new Date(to);
  t.setHours(23, 59, 59, 999);
  return d >= f && d <= t;
}

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function getWeekAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

export function getMonthAgoStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
}

export const PLANS = {
  START: { 
    name: 'Boshlang\'ich', 
    badge: '🥉',
    price: 199999, 
    maxLogins: 3,
    description: 'Tizimni endi joriy etayotgan ixcham shoxobchalar uchun',
    features: [
      'Maksimal 3 kishi (1 rahbar + 2 kassir)',
      'Savdo, ombor va xarajatlar hisobi',
      'Ekranda ko\'rish',
      'Login va parol himoyasi'
    ],
    allowedRoutes: ['/dashboard', '/dashboard/finance', '/dashboard/meter', '/dashboard/archive', '/dashboard/security'],
    canExportPdf: false,
    canExportExcel: false,
    hasCharts: false,
    hasTelegramBot: false,
    hasActionHistory: false,
    hasFaceId: false,
    hasPrioritySupport: false
  },
  STANDART: { 
    name: 'Standart', 
    badge: '🥈',
    popular: true,
    price: 399999, 
    maxLogins: 6,
    description: 'Eng ommabop tarif - professional hisobotlar va nazorat',
    features: [
      'Maksimal 6 kishi',
      'Barcha Boshlang\'ich imkoniyatlari',
      'PDF eksport (professional dizayn)',
      'Savdo dinamikasi grafiklari',
      'Telegram bot (kunlik hisobot)',
      'Parol + Harakatlar tarixi'
    ],
    allowedRoutes: ['/dashboard', '/dashboard/finance', '/dashboard/expenses', '/dashboard/meter', '/dashboard/archive', '/dashboard/workers', '/dashboard/plomba', '/dashboard/security', '/dashboard/telegram'],
    canExportPdf: true,
    canExportExcel: false,
    hasCharts: true,
    hasTelegramBot: true,
    hasActionHistory: true,
    hasFaceId: false,
    hasPrioritySupport: false
  },
  PREMIUM: { 
    name: 'Premium', 
    badge: '🥇',
    price: 699999, 
    maxLogins: 8,
    description: 'Eng yuqori daraja - to\'liq nazorat va ustuvor yordam',
    features: [
      'Maksimal 8 kishi',
      'Barcha Standart imkoniyatlari',
      'PDF + Excel eksport',
      'Chuqurlashtirilgan analitika',
      'Telegram bot (jonli xabarlar)',
      'Face ID tekshirish',
      'AI yordamchi',
      'Referal tizimi',
      'Ustuvor texnik yordam'
    ],
    allowedRoutes: ['/dashboard', '/dashboard/finance', '/dashboard/expenses', '/dashboard/meter', '/dashboard/archive', '/dashboard/workers', '/dashboard/plomba', '/dashboard/referrals', '/dashboard/security', '/dashboard/ai', '/dashboard/telegram'],
    canExportPdf: true,
    canExportExcel: true,
    hasCharts: true,
    hasTelegramBot: true,
    hasActionHistory: true,
    hasFaceId: true,
    hasPrioritySupport: true
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function canExportPdf(plan: PlanKey): boolean {
  return PLANS[plan].canExportPdf;
}

export function canExportExcel(plan: PlanKey): boolean {
  return PLANS[plan].canExportExcel;
}

export function hasCharts(plan: PlanKey): boolean {
  return PLANS[plan].hasCharts;
}

export function getMaxLogins(plan: PlanKey): number {
  return PLANS[plan].maxLogins;
}

export function hasActionHistory(plan: PlanKey): boolean {
  return PLANS[plan].hasActionHistory;
}

export function hasFaceId(plan: PlanKey): boolean {
  return PLANS[plan].hasFaceId;
}

export function hasPrioritySupport(plan: PlanKey): boolean {
  return PLANS[plan].hasPrioritySupport;
}

export function isRouteAllowed(plan: PlanKey, route: string): boolean {
  return (PLANS[plan].allowedRoutes as readonly string[]).includes(route);
}

export function getNavItemsForPlan(plan: PlanKey): readonly string[] {
  return PLANS[plan].allowedRoutes;
}
