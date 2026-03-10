// localStorage-based data store for BAREL.uz
export interface FuelType {
  name: string;
  unit: string;
  meterCount?: number; // nechta hisoblagich (default 1)
}

export interface DayRecord {
  date: string;
  operator: string;
  stationIndex: number; // which station this record belongs to
  fuels: {
    type: string; // e.g. "AI-92 #1" or "AI-92"
    start: number;
    sold: number;
    end: number;
    price: number;
    prixod?: number;
    tannarx?: number;
  }[];
  expenses: { reason: string; amount: number }[];
  terminal: number;
  savedAt?: string; // ISO timestamp for 30-min edit window
}

export interface Company {
  key: string;
  name: string;
  phone: string;
  stations: string[];
  fuelTypes: FuelType[];
  stationConfigs?: { fuelTypes: FuelType[] }[]; // per-station fuel configs
  plan: 'START' | 'STANDART' | 'PREMIUM';
  subscription: {
    status: 'trial' | 'active' | 'expired' | 'suspended';
    trial_end_date: string;
    active_until?: string;
  };
  referred_by?: string;
  promocode: string;
  users: CompanyUser[];
  data: DayRecord[];
  conf: {
    prices: Record<string, number>;
    fix: number;
  };
  logs: LogEntry[];
  locks: {
    plomba: boolean;
    start: boolean;
    main: boolean;
  };
  ops: { op1: string; op2: string };
  plomba: PlombaRecord[];
  securityPassword: string;
  created_at: string;
}

export interface CompanyUser {
  login: string;
  password: string;
  name: string;
  role: 'BOSS' | 'OPERATOR' | 'OMBORCHI';
  stationIndex?: number; // which station this user is assigned to
}

export interface LogEntry {
  timestamp: string;
  user: string;
  action: string;
  detail: string;
}

export interface PlombaRecord {
  date: string;
  numbers: string[];
  status: string;
}

export interface Payment {
  id: string;
  companyKey: string;
  amount: number;
  payment_date: string;
  status: 'pending' | 'approved' | 'rejected';
  receipt_base64?: string;
  approved_until?: string;
}

export interface FeatureRequest {
  id: string;
  companyKey: string;
  companyName: string;
  description: string;
  status: 'pending' | 'priced' | 'paid' | 'done' | 'rejected';
  price?: number;
  adminResponse?: string;
  adminPrompt?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminCardInfo {
  cardNumber: string;
  cardHolder: string;
}

export interface ContactInfo {
  phone: string;
  telegramBot: string;
  telegramChannel: string;
  instagram: string;
}

export interface CustomFeature {
  id: string;
  title: string;
  description: string;
  prompt: string;
  targetPlan: 'START' | 'STANDART' | 'PREMIUM';
  status: 'draft' | 'testing' | 'active' | 'rejected';
  fromRequestId?: string; // linked feature request id
  created_at: string;
  updated_at: string;
  testedAt?: string;
  deployedAt?: string;
}

const DEFAULT_CONTACTS: ContactInfo = {
  phone: '+998997771702',
  telegramBot: '@Barel_uz_bot',
  telegramChannel: 'https://t.me/BAREL_UZ',
  instagram: 'https://www.instagram.com/barel.uz?igsh=MzJsdDR3NDJ1bGpq&utm_source=qr',
};

const STORAGE_KEYS = {
  COMPANIES: 'barel_companies',
  CURRENT_COMPANY: 'barel_current_company',
  CURRENT_USER: 'barel_current_user',
  CURRENT_STATION: 'barel_current_station',
  PAYMENTS: 'barel_payments',
  FEATURE_REQUESTS: 'barel_feature_requests',
  ADMIN_CARD: 'barel_admin_card',
  ADMIN_CONTACTS: 'barel_admin_contacts',
  CUSTOM_FEATURES: 'barel_custom_features',
  SUPERADMIN_KEY: 'ZARIPOVM',
  SUPERADMIN_PASSWORD: '201116ZM',
};

// Admin card info
export function getAdminCard(): AdminCardInfo {
  return loadJSON(STORAGE_KEYS.ADMIN_CARD, { cardNumber: '', cardHolder: '' });
}
export function saveAdminCard(card: AdminCardInfo) {
  saveJSON(STORAGE_KEYS.ADMIN_CARD, card);
}

// Contact info
export function getContacts(): ContactInfo {
  return loadJSON(STORAGE_KEYS.ADMIN_CONTACTS, DEFAULT_CONTACTS);
}
export function saveContacts(contacts: ContactInfo) {
  saveJSON(STORAGE_KEYS.ADMIN_CONTACTS, contacts);
}

// Custom features
export function getCustomFeatures(): CustomFeature[] {
  return loadJSON(STORAGE_KEYS.CUSTOM_FEATURES, []);
}
export function saveCustomFeatures(features: CustomFeature[]) {
  saveJSON(STORAGE_KEYS.CUSTOM_FEATURES, features);
}
export function addCustomFeature(feature: CustomFeature) {
  const all = getCustomFeatures();
  all.push(feature);
  saveCustomFeatures(all);
}
export function updateCustomFeature(id: string, updater: (f: CustomFeature) => CustomFeature) {
  const all = getCustomFeatures();
  const idx = all.findIndex(f => f.id === id);
  if (idx >= 0) {
    all[idx] = updater(all[idx]);
    saveCustomFeatures(all);
  }
}
export function getActiveFeaturesByPlan(plan: 'START' | 'STANDART' | 'PREMIUM'): CustomFeature[] {
  return getCustomFeatures().filter(f => f.status === 'active' && f.targetPlan === plan);
}
export function getTestingFeaturesByPlan(plan: 'START' | 'STANDART' | 'PREMIUM'): CustomFeature[] {
  return getCustomFeatures().filter(f => f.status === 'testing' && f.targetPlan === plan);
}

// Demo company for feature testing
const DEMO_COMPANY_KEY = 'demo_test_company';

export function createOrUpdateDemoCompany(plan: 'START' | 'STANDART' | 'PREMIUM', featureTitle: string): void {
  const companies = getCompanies();
  const existingIdx = companies.findIndex(c => c.key === DEMO_COMPANY_KEY);
  
  const demoCompany: Company = {
    key: DEMO_COMPANY_KEY,
    name: `Demo Test — ${featureTitle}`,
    phone: '+998000000000',
    stations: ['Demo Zapravka'],
    fuelTypes: [
      { name: 'AI-92', unit: 'litr', meterCount: 1 },
      { name: 'AI-95', unit: 'litr', meterCount: 1 },
      { name: 'Dizel', unit: 'litr', meterCount: 1 },
    ],
    stationConfigs: [{
      fuelTypes: [
        { name: 'AI-92', unit: 'litr', meterCount: 1 },
        { name: 'AI-95', unit: 'litr', meterCount: 1 },
        { name: 'Dizel', unit: 'litr', meterCount: 1 },
      ]
    }],
    plan,
    subscription: {
      status: 'active',
      trial_end_date: new Date(Date.now() + 365 * 86400000).toISOString(),
      active_until: new Date(Date.now() + 365 * 86400000).toISOString(),
    },
    promocode: 'DEMO',
    users: [
      { login: 'demo', password: 'demo', name: 'Demo Boss', role: 'BOSS' },
      { login: 'demo_op', password: 'demo', name: 'Demo Operator', role: 'OPERATOR' },
    ],
    data: [],
    conf: { prices: { 'AI-92': 12500, 'AI-95': 13500, 'Dizel': 14000 }, fix: 0 },
    logs: [],
    locks: { plomba: false, start: false, main: false },
    ops: { op1: '', op2: '' },
    plomba: [],
    securityPassword: 'demo',
    created_at: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    companies[existingIdx] = demoCompany;
  } else {
    companies.push(demoCompany);
  }
  saveCompanies(companies);
}

export function removeDemoCompany(): void {
  const companies = getCompanies().filter(c => c.key !== DEMO_COMPANY_KEY);
  saveCompanies(companies);
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Companies
export function getCompanies(): Company[] {
  return loadJSON(STORAGE_KEYS.COMPANIES, []);
}
export function saveCompanies(companies: Company[]) {
  saveJSON(STORAGE_KEYS.COMPANIES, companies);
}
export function getCompanyByKey(key: string): Company | undefined {
  return getCompanies().find(c => c.key === key);
}
export function updateCompany(key: string, updater: (c: Company) => Company) {
  const companies = getCompanies();
  const idx = companies.findIndex(c => c.key === key);
  if (idx >= 0) {
    companies[idx] = updater(companies[idx]);
    saveCompanies(companies);
  }
}

// Current session
export function getCurrentCompanyKey(): string | null {
  return localStorage.getItem(STORAGE_KEYS.CURRENT_COMPANY);
}
export function setCurrentCompanyKey(key: string) {
  localStorage.setItem(STORAGE_KEYS.CURRENT_COMPANY, key);
}
export function getCurrentUser(): { login: string; role: string; name: string; companyKey: string } | null {
  return loadJSON(STORAGE_KEYS.CURRENT_USER, null);
}
export function setCurrentUser(user: { login: string; role: string; name: string; companyKey: string }) {
  saveJSON(STORAGE_KEYS.CURRENT_USER, user);
}
export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_COMPANY);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_STATION);
}

export function getCurrentStation(): number {
  return parseInt(localStorage.getItem(STORAGE_KEYS.CURRENT_STATION) || '0');
}
export function setCurrentStation(idx: number) {
  localStorage.setItem(STORAGE_KEYS.CURRENT_STATION, String(idx));
}

// Payments
export function getPayments(): Payment[] {
  return loadJSON(STORAGE_KEYS.PAYMENTS, []);
}
export function savePayments(payments: Payment[]) {
  saveJSON(STORAGE_KEYS.PAYMENTS, payments);
}
export function addPayment(payment: Payment) {
  const payments = getPayments();
  payments.push(payment);
  savePayments(payments);
}

// Feature Requests
export function getFeatureRequests(): FeatureRequest[] {
  return loadJSON(STORAGE_KEYS.FEATURE_REQUESTS, []);
}
export function saveFeatureRequests(requests: FeatureRequest[]) {
  saveJSON(STORAGE_KEYS.FEATURE_REQUESTS, requests);
}
export function addFeatureRequest(request: FeatureRequest) {
  const requests = getFeatureRequests();
  requests.push(request);
  saveFeatureRequests(requests);
}
export function updateFeatureRequest(id: string, updater: (r: FeatureRequest) => FeatureRequest) {
  const requests = getFeatureRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx >= 0) {
    requests[idx] = updater(requests[idx]);
    saveFeatureRequests(requests);
  }
}

// Auth
export function authenticate(login: string, password: string): { success: boolean; isSuperAdmin?: boolean; isLooker?: boolean; user?: CompanyUser; companyKey?: string } {
  if (login.toUpperCase() === STORAGE_KEYS.SUPERADMIN_KEY && password === STORAGE_KEYS.SUPERADMIN_PASSWORD) {
    return { success: true, isSuperAdmin: true };
  }
  
  const companies = getCompanies();
  for (const company of companies) {
    const user = company.users.find(u => u.login === login && u.password === password);
    if (user) {
      return { success: true, user, companyKey: company.key };
    }
  }
  return { success: false };
}

export function registerCompany(data: {
  firstName: string;
  lastName: string;
  companyName: string;
  phone: string;
  stations: string[];
  stationConfigs: { fuelTypes: FuelType[] }[];
  plan: 'START' | 'STANDART' | 'PREMIUM';
  login: string;
  password: string;
  promocode?: string;
  securityPassword: string;
}): { success: boolean; error?: string } {
  const companies = getCompanies();
  
  // Check login uniqueness
  for (const c of companies) {
    if (c.users.some(u => u.login === data.login)) {
      return { success: false, error: 'Bu login allaqachon band!' };
    }
  }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);

  // Aggregate all unique fuel types across stations
  const allFuelTypes: FuelType[] = [];
  const seen = new Set<string>();
  for (const sc of data.stationConfigs) {
    for (const ft of sc.fuelTypes) {
      if (!seen.has(ft.name)) {
        seen.add(ft.name);
        allFuelTypes.push(ft);
      }
    }
  }

  const key = `company_${Date.now()}`;
  const newCompany: Company = {
    key,
    name: data.companyName,
    phone: data.phone,
    stations: data.stations,
    fuelTypes: allFuelTypes,
    stationConfigs: data.stationConfigs,
    plan: data.plan,
    subscription: {
      status: 'trial',
      trial_end_date: trialEnd.toISOString(),
    },
    referred_by: data.promocode || undefined,
    promocode: data.login.toUpperCase(),
    users: [{
      login: data.login,
      password: data.password,
      name: `${data.firstName} ${data.lastName}`,
      role: 'BOSS',
    }],
    data: [],
    conf: { prices: {}, fix: 0 },
    logs: [],
    locks: { plomba: false, start: false, main: false },
    ops: { op1: 'Operator 1', op2: 'Operator 2' },
    plomba: [],
    securityPassword: data.securityPassword,
    created_at: new Date().toISOString(),
  };

  companies.push(newCompany);
  saveCompanies(companies);
  return { success: true };
}

// Helper to get fuel types for a specific station (falls back to company.fuelTypes)
export function getStationFuelTypes(company: Company, stationIndex: number): FuelType[] {
  if (company.stationConfigs && company.stationConfigs[stationIndex]) {
    return company.stationConfigs[stationIndex].fuelTypes;
  }
  return company.fuelTypes;
}

// Get data filtered by station index (backward compat: records without stationIndex are station 0)
export function getStationData(company: Company, stationIndex: number): DayRecord[] {
  return company.data.filter(d => (d.stationIndex ?? 0) === stationIndex);
}

// Get base fuel name from meter label (e.g. "AI-92 #1" → "AI-92")
export function getBaseFuelName(type: string): string {
  return type.replace(/ #\d+$/, '');
}

// Get aggregated fuel stats per base type for a station (combines multi-meter)
export function getAggregatedFuelStats(company: Company, stationIndex: number) {
  const stationData = getStationData(company, stationIndex);
  const stationFuels = getStationFuelTypes(company, stationIndex);
  
  // Get last day data
  const sortedData = [...stationData].sort((a, b) => b.date.localeCompare(a.date));
  const lastDay = sortedData[0];
  
  return stationFuels.map(ft => {
    const count = ft.meterCount || 1;
    // For remaining: sum all meters of this fuel type from last day
    let remaining = 0;
    let lastSold = 0;
    
    if (lastDay) {
      for (let m = 0; m < count; m++) {
        const label = count > 1 ? `${ft.name} #${m + 1}` : ft.name;
        const fuel = lastDay.fuels.find(f => f.type === label);
        if (fuel) {
          // Remaining = end value (last meter reading)
          // For multi-meter: they share the same tank, so we take end from any (they should be similar)
          // Actually for inventory tracking, remaining should be calculated from prixod and sold
          lastSold += fuel.sold;
        }
      }
    }
    
    // Calculate remaining inventory from all data (total prixod - total sold)
    let totalPrixod = 0;
    let totalSold = 0;
    for (const day of stationData) {
      for (let m = 0; m < count; m++) {
        const label = count > 1 ? `${ft.name} #${m + 1}` : ft.name;
        const fuel = day.fuels.find(f => f.type === label);
        if (fuel) {
          totalPrixod += fuel.prixod || 0;
          totalSold += fuel.sold;
        }
      }
    }
    remaining = totalPrixod - totalSold;
    if (remaining < 0) remaining = 0; // can happen with initial data
    
    // If we have a last day end value and no prixod tracking, use end value as remaining
    if (totalPrixod === 0 && lastDay) {
      remaining = 0;
      for (let m = 0; m < count; m++) {
        const label = count > 1 ? `${ft.name} #${m + 1}` : ft.name;
        const fuel = lastDay.fuels.find(f => f.type === label);
        if (fuel) remaining += fuel.end;
      }
    }

    // Average daily sales (last 30 days)
    const last30 = stationData.filter(d => {
      const diff = (Date.now() - new Date(d.date).getTime()) / 86400000;
      return diff <= 30;
    });
    let totalSoldLast30 = 0;
    for (const day of last30) {
      for (let m = 0; m < count; m++) {
        const label = count > 1 ? `${ft.name} #${m + 1}` : ft.name;
        const fuel = day.fuels.find(f => f.type === label);
        if (fuel) totalSoldLast30 += fuel.sold;
      }
    }
    const avgDaily = last30.length > 0 ? totalSoldLast30 / last30.length : 0;
    
    // Month-to-date sales
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    let monthSold = 0;
    for (const day of stationData) {
      if (day.date >= monthStart) {
        for (let m = 0; m < count; m++) {
          const label = count > 1 ? `${ft.name} #${m + 1}` : ft.name;
          const fuel = day.fuels.find(f => f.type === label);
          if (fuel) monthSold += fuel.sold;
        }
      }
    }
    
    // Days remaining
    const daysRemaining = avgDaily > 0 ? remaining / avgDaily : 999;

    return {
      name: ft.name,
      unit: ft.unit,
      remaining,
      lastSold,
      avgDaily: Math.round(avgDaily),
      monthSold,
      daysRemaining: Math.round(daysRemaining * 10) / 10,
      price: 0, // will be set from conf
    };
  });
}

// Subscription check
export function checkSubscription(company: Company): { locked: boolean; warning: boolean; daysLeft?: number } {
  const now = new Date();
  
  if (company.subscription.status === 'suspended') {
    return { locked: true, warning: false };
  }
  
  if (company.subscription.status === 'active' && company.subscription.active_until) {
    const until = new Date(company.subscription.active_until);
    if (now > until) {
      return { locked: true, warning: false };
    }
    const daysLeft = Math.ceil((until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { locked: false, warning: daysLeft <= 3, daysLeft };
  }
  
  if (company.subscription.status === 'trial') {
    const trialEnd = new Date(company.subscription.trial_end_date);
    if (now > trialEnd) {
      return { locked: true, warning: false };
    }
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { locked: false, warning: daysLeft <= 2, daysLeft };
  }
  
  return { locked: true, warning: false };
}

// Logging
export function addLog(companyKey: string, user: string, action: string, detail: string) {
  updateCompany(companyKey, (c) => ({
    ...c,
    logs: [...c.logs, {
      timestamp: new Date().toISOString(),
      user,
      action,
      detail,
    }],
  }));
}

// Demo data seeder
export function seedDemoData() {
  if (getCompanies().length > 0) return;
  
  const station1Fuels: FuelType[] = [
    { name: 'Propan', unit: 'L', meterCount: 1 },
    { name: 'AI-91', unit: 'L', meterCount: 1 },
    { name: 'AI-92', unit: 'L', meterCount: 2 },
    { name: 'AI-95', unit: 'L', meterCount: 1 },
    { name: 'Dizel', unit: 'L', meterCount: 1 },
    { name: 'Metan', unit: 'm³', meterCount: 1 },
  ];

  const station2Fuels: FuelType[] = [
    { name: 'AI-92', unit: 'L', meterCount: 1 },
    { name: 'AI-95', unit: 'L', meterCount: 1 },
    { name: 'Dizel', unit: 'L', meterCount: 1 },
  ];

  const prices: Record<string, number> = { 'Propan': 6500, 'AI-91': 9200, 'AI-92': 9800, 'AI-95': 10500, 'Dizel': 9800, 'Metan': 2200 };

  // Generate demo data for station 1
  const generateStationData = (stationIdx: number, fuels: FuelType[]): DayRecord[] => {
    const data: DayRecord[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const expandedFuels: DayRecord['fuels'] = [];
      fuels.forEach(ft => {
        const count = ft.meterCount || 1;
        for (let m = 0; m < count; m++) {
          const label = count > 1 ? `${ft.name} #${m + 1}` : ft.name;
          const start = 10000 + Math.floor(Math.random() * 5000);
          const sold = 200 + Math.floor(Math.random() * 800);
          expandedFuels.push({
            type: label,
            start,
            sold,
            end: start + sold,
            price: prices[ft.name] || 9500,
            prixod: Math.random() > 0.7 ? 500 + Math.floor(Math.random() * 2000) : 0,
            tannarx: Math.random() > 0.7 ? (prices[ft.name] || 9500) * 0.85 : 0,
          });
        }
      });
      data.push({
        date: d.toISOString().split('T')[0],
        operator: stationIdx === 0 ? 'Aliyev Jasur' : 'Rahimov Sardor',
        stationIndex: stationIdx,
        fuels: expandedFuels,
        expenses: [{ reason: 'Elektr energiya', amount: 150000 + Math.floor(Math.random() * 100000) }],
        terminal: 500000 + Math.floor(Math.random() * 2000000),
      });
    }
    return data;
  };

  const allData = [...generateStationData(0, station1Fuels), ...generateStationData(1, station2Fuels)];

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 5);

  const allFuelTypes = station1Fuels; // superset

  const demoCompany: Company = {
    key: 'demo_company',
    name: 'BUXORO YOQILG\'I MCHJ',
    phone: '+998 91 123 45 67',
    stations: ['BUXORO-1', 'QORAKUL-2'],
    fuelTypes: allFuelTypes,
    stationConfigs: [
      { fuelTypes: station1Fuels },
      { fuelTypes: station2Fuels },
    ],
    plan: 'STANDART',
    subscription: { status: 'trial', trial_end_date: trialEnd.toISOString() },
    promocode: 'DEMO',
    users: [
      { login: 'demo', password: 'demo', name: 'Zaripov Mansur', role: 'BOSS' },
      { login: 'ishchi1', password: '1234', name: 'Aliyev Jasur', role: 'OPERATOR', stationIndex: 0 },
      { login: 'ishchi2', password: '1234', name: 'Rahimov Sardor', role: 'OPERATOR', stationIndex: 1 },
      { login: 'ombor1', password: '1234', name: 'Karimov Bekzod', role: 'OMBORCHI' },
    ],
    data: allData,
    conf: {
      prices,
      fix: 2500000,
    },
    logs: [
      { timestamp: new Date().toISOString(), user: 'demo', action: 'Kirish', detail: 'Tizimga kirdi' },
    ],
    locks: { plomba: false, start: false, main: false },
    ops: { op1: 'Aliyev Jasur', op2: 'Karimov Bekzod' },
    plomba: [
      { date: new Date().toISOString().split('T')[0], numbers: ['PL-001', 'PL-002', 'PL-003'], status: 'Yaxshi' },
    ],
    securityPassword: '20113',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  };

  saveCompanies([demoCompany]);
}

export { STORAGE_KEYS };
