import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompany, addLog } from '@/lib/store';
import { formatDate, formatDateTime } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Lock, Trash2, Play, Image, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import GlassCard from '@/components/GlassCard';

export default function PlombaPage() {
  const { company, user, refreshCompany } = useAuth();

  if (!company) return null;

  // Check if plomba is within 10-min edit window
  const canEdit = (plomba: { date: string }) => {
    const created = new Date(plomba.date).getTime();
    const now = Date.now();
    return (now - created) < 10 * 60 * 1000;
  };

  const deletePlomba = (idx: number) => {
    const realIdx = company.plomba.length - 1 - idx;
    const p = company.plomba[realIdx];
    if (!canEdit(p)) { toast.error("10 daqiqa o'tdi, o'chirish mumkin emas!"); return; }
    updateCompany(company.key, c => {
      const plomba = [...c.plomba];
      plomba.splice(realIdx, 1);
      return { ...c, plomba };
    });
    addLog(company.key, user?.login || '', 'Plomba', "Plomba o'chirildi");
    refreshCompany();
    toast.success("Plomba o'chirildi!");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">PLOMBA NAZORATI</h1>

      <GlassCard>
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" /> Plomba tarixi
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          📱 Plomba qo'shish va almashtirish Telegram bot orqali amalga oshiriladi (Omborchi roli).
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
              {company.plomba.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Ma'lumot yo'q</td></tr>
              ) : company.plomba.slice().reverse().map((p, i) => {
                const editable = canEdit(p);
                const hasNewFlow = !!p.oldPlombaNumber || !!p.newPlombaNumber;
                return (
                  <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-2 text-xs">{formatDateTime(p.date)}</td>
                    <td className="py-3 px-2">
                      {hasNewFlow ? (
                        <div>
                          <span className="text-destructive font-medium">#{p.oldPlombaNumber}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {hasNewFlow ? (
                        <span className="text-success font-medium">#{p.newPlombaNumber}</span>
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
                            <Image className="h-3 w-3" /> Rasm
                          </a>
                        )}
                        {!p.oldPlombaVideoUrl && !p.newPlombaPhotoUrl && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="bg-success/10 text-success text-xs px-2 py-0.5 rounded-md">{p.status}</span>
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
