import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Reminder } from '@/pages/dashboard/RemindersPage';

function loadReminders(companyKey: string): Reminder[] {
  try {
    return JSON.parse(localStorage.getItem(`barel_reminders_${companyKey}`) || '[]');
  } catch { return []; }
}

export default function ReminderNotifications() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const check = () => {
      if (!company) return;
      const reminders = loadReminders(company.key);
      const now = new Date();
      let due = 0;

      for (const r of reminders) {
        if (r.status !== 'active') continue;
        if (!r.date && !r.time) { due++; continue; }
        if (r.snoozedUntilDate || r.snoozedUntilTime) {
          const sDate = r.snoozedUntilDate || '';
          const sTime = r.snoozedUntilTime || '00:00';
          if (now >= new Date(`${sDate}T${sTime}:00`)) due++;
          continue;
        }
        if (r.date) {
          const rTime = r.time || '00:00';
          if (now >= new Date(`${r.date}T${rTime}:00`)) due++;
        }
      }
      setCount(due);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [company?.key]);

  if (count === 0) return null;

  return (
    <button
      onClick={() => navigate('/dashboard/reminders')}
      className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
    >
      <Bell className="h-5 w-5 text-primary" />
      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
        {count}
      </span>
    </button>
  );
}
