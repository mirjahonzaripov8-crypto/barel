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
    price: 200000, 
    maxLogins: 2,
    features: [
      '2 ta login (kassir/ishchi)',
      'Savdo va ombor hisobi',
      'Ekranda ko\'rish',
      'Parol himoyasi'
    ],
    allowedRoutes: ['/dashboard', '/dashboard/finance', '/dashboard/meter', '/dashboard/archive', '/dashboard/security'],
    canExportPdf: false,
    canExportExcel: false,
    hasCharts: false,
    hasTelegramBot: false
  },
  STANDART: { 
    name: 'Standart', 
    badge: '🥈',
    popular: true,
    price: 450000, 
    maxLogins: 5,
    features: [
      '5 tagacha login',
      'Savdo va ombor hisobi',
      'PDF eksport (Zebra dizayn)',
      'Sotuv dinamikasi diagrammasi',
      'Telegram bot (kunlik hisobot)',
      'Parol + Harakatlar tarixi'
    ],
    allowedRoutes: ['/dashboard', '/dashboard/finance', '/dashboard/expenses', '/dashboard/meter', '/dashboard/archive', '/dashboard/workers', '/dashboard/plomba', '/dashboard/security'],
    canExportPdf: true,
    canExportExcel: false,
    hasCharts: true,
    hasTelegramBot: true
  },
  PREMIUM: { 
    name: 'Premium', 
    badge: '🥇',
    price: 800000, 
    maxLogins: Infinity,
    features: [
      'Cheksiz loginlar',
      'Savdo va ombor hisobi',
      'PDF + Excel eksport',
      'Barcha analitika diagrammalari',
      'Telegram bot (jonli xabarlar)',
      'Face ID / Barmoq izi',
      'AI yordamchi',
      'Referal tizimi'
    ],
    allowedRoutes: ['/dashboard', '/dashboard/finance', '/dashboard/expenses', '/dashboard/meter', '/dashboard/archive', '/dashboard/workers', '/dashboard/plomba', '/dashboard/referrals', '/dashboard/security', '/dashboard/ai'],
    canExportPdf: true,
    canExportExcel: true,
    hasCharts: true,
    hasTelegramBot: true
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

export function isRouteAllowed(plan: PlanKey, route: string): boolean {
  return (PLANS[plan].allowedRoutes as readonly string[]).includes(route);
}

export function getNavItemsForPlan(plan: PlanKey): readonly string[] {
  return PLANS[plan].allowedRoutes;
}
