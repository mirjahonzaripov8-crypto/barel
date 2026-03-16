import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompany, addLog, type PlombaRecord } from '@/lib/store';
import { formatDateTime } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Lock, Trash2, Play, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import GlassCard from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';

export default function PlombaPage() {
  const { company, user, refreshCompany } = useAuth();
  const [cloudPlomba, setCloudPlomba] = useState<PlombaRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch plomba records from cloud (telegram_settings)
  const fetchCloudPlomba = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('telegram_settings')
        .select('company_data')
        .eq('company_key', company.key)
        .maybeSingle();
      const plomba = (data?.company_data as any)?.plomba || [];
      setCloudPlomba(plomba);
    } catch (err) {
      console.error('Failed to fetch cloud plomba:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCloudPlomba(); }, [company?.key]);

  if (!company) return null;

  // Merge local and cloud plomba records, deduplicate by date
  const allPlomba: PlombaRecord[] = [...company.plomba];
  for (const cp of cloudPlomba) {
    const exists = allPlomba.some(p => p.date === cp.date && p.newPlombaNumber === cp.newPlombaNumber);
    if (!exists) allPlomba.push(cp);
  }
  allPlomba.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const canEdit = (plomba: { date: string }) => {
    const created = new Date(plomba.date).getTime();
    return (Date.now() - created) < 10 * 60 * 1000;
  };

  const deletePlomba = (idx: number) => {
    const p = allPlomba[idx];
    if (!canEdit(p)) { toast.error("10 daqiqa o'tdi, o'chirish mumkin emas!"); return; }
    
    // Check if it's a local record
    const localIdx = company.plomba.findIndex(lp => lp.date === p.date);
    if (localIdx >= 0) {
      updateCompany(company.key, c => {
        const plomba = [...c.plomba];
        plomba.splice(localIdx, 1);
        return { ...c, plomba };
      });
    }
    
    addLog(company.key, user?.login || '', 'Plomba', "Plomba o'chirildi");
    refreshCompany();
    toast.success("Plomba o'chirildi!");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">PLOMBA NAZORATI</h1>
        <Button variant="outline" size="sm" onClick={fetchCloudPlomba} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Yangilash
        </Button>
      </div>

      <GlassCard>
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" /> Plomba tarixi
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          📱 Plomba almashtirish Telegram bot orqali amalga oshiriladi (Omborchi roli).
          <br />Jarayon: Eski plomba raqami → Uzish videosi → Yangi plomba raqami → O'rnatish rasmi
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Sana</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Eski plomba</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Yangi plomba</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Kim</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Media</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Holat</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium text-xs">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {allPlomba.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Ma'lumot yo'q</td></tr>
              ) : allPlomba.map((p, i) => {
                const editable = canEdit(p);
                const hasNewFlow = !!p.oldPlombaNumber || !!p.newPlombaNumber;
                return (
                  <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-2 text-xs">{formatDateTime(p.date)}</td>
                    <td className="py-3 px-2">
                      {hasNewFlow ? (
                        <span className="text-destructive font-medium">#{p.oldPlombaNumber}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {hasNewFlow ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">#{p.newPlombaNumber}</span>
                      ) : (
                        <span>{p.numbers.join(', ')}</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-xs text-muted-foreground">{p.changedBy || '—'}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        {p.oldPlombaVideoUrl && (
                          <a href={p.oldPlombaVideoUrl} target="_blank" rel="noopener noreferrer" 
                             className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-md hover:bg-destructive/20 transition-colors">
                            <Play className="h-3 w-3" /> Video
                          </a>
                        )}
                        {p.newPlombaPhotoUrl && (
                          <a href={p.newPlombaPhotoUrl} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md hover:bg-primary/20 transition-colors">
                            <ImageIcon className="h-3 w-3" /> Rasm
                          </a>
                        )}
                        {!p.oldPlombaVideoUrl && !p.newPlombaPhotoUrl && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-md ${
                        p.status === 'Almashtirildi' 
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                          : 'bg-green-500/10 text-green-600 dark:text-green-400'
                      }`}>{p.status}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      {editable ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePlomba(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">🔒</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">⏱️ Plomba kiritilgandan so'ng faqat 10 daqiqa ichida o'chirish mumkin</p>
      </GlassCard>
    </div>
  );
}
