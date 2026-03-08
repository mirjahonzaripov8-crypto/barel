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
    name: 'START', 
    price: 399000, 
    features: ['1 ta zapravka', 'Kunlik hisoblagich', 'Moliya', 'Arxiv'],
    allowedRoutes: ['/dashboard', '/dashboard/finance', '/dashboard/expenses', '/dashboard/meter', '/dashboard/archive', '/dashboard/security']
  },
  PRO: { 
    name: 'PRO', 
    price: 599000, 
    features: ['3 ta zapravka', 'Barcha START imkoniyatlari', 'Xodimlar boshqaruvi', 'PDF eksport', 'Plomba nazorati'],
    allowedRoutes: ['/dashboard', '/dashboard/finance', '/dashboard/expenses', '/dashboard/meter', '/dashboard/archive', '/dashboard/workers', '/dashboard/plomba', '/dashboard/security']
  },
  PREMIUM: { 
    name: 'PREMIUM', 
    price: 899000, 
    features: ['Cheksiz zapravka', 'Barcha PRO imkoniyatlari', 'AI yordamchi', 'Referral tizimi', 'Prioritet yordam'],
    allowedRoutes: ['/dashboard', '/dashboard/finance', '/dashboard/expenses', '/dashboard/meter', '/dashboard/archive', '/dashboard/workers', '/dashboard/plomba', '/dashboard/referrals', '/dashboard/security', '/dashboard/ai']
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function isRouteAllowed(plan: PlanKey, route: string): boolean {
  return (PLANS[plan].allowedRoutes as readonly string[]).includes(route);
}

export function getNavItemsForPlan(plan: PlanKey): readonly string[] {
  return PLANS[plan].allowedRoutes;
}
