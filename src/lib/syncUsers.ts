import { supabase } from '@/integrations/supabase/client';
import type { Company } from '@/lib/store';

/**
 * Sync all company users to the database (company_users table)
 * so the Telegram bot can authenticate operators.
 */
export async function syncCompanyUsersToDb(company: Company) {
  try {
    // Delete existing users for this company
    await supabase
      .from('company_users' as any)
      .delete()
      .eq('company_key', company.key);

    // Insert all current users
    const rows = company.users.map(u => ({
      company_key: company.key,
      company_name: company.name,
      login: u.login,
      password: u.password,
      name: u.name,
      role: u.role,
    }));

    if (rows.length > 0) {
      await supabase
        .from('company_users' as any)
        .insert(rows);
    }

    // Also update company_data in telegram_settings with fuel types
    await supabase
      .from('telegram_settings')
      .update({
        company_data: {
          fuelTypes: company.fuelTypes.map(f => f.name),
          companyName: company.name,
        },
      } as any)
      .eq('company_key', company.key);

  } catch (err) {
    console.error('Failed to sync company users to DB:', err);
  }
}
