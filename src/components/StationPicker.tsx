import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Fuel, Zap } from 'lucide-react';
import { setCurrentStation } from '@/lib/store';

interface StationPickerProps {
  stations: string[];
  onSelect: (index: number) => void;
}

export default function StationPicker({ stations, onSelect }: StationPickerProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleConfirm = () => {
    if (selected === null) return;
    setCurrentStation(selected);
    onSelect(selected);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/60 to-background p-4">
      <div className="animate-scale-in w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-4">
              <Zap className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">BAREL<span className="text-primary">.uz</span></span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Zapravkani tanlang</h2>
            <p className="text-sm text-muted-foreground mt-1">Qaysi zapravka bilan ishlaysiz?</p>
          </div>

          <div className="space-y-3 mb-6">
            {stations.map((station, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                  selected === i
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selected === i ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}>
                  <Fuel className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">{station}</p>
                  <p className="text-xs text-muted-foreground">Zapravka #{i + 1}</p>
                </div>
              </button>
            ))}
          </div>

          <Button
            onClick={handleConfirm}
            disabled={selected === null}
            className="w-full h-11 text-base shadow-button hover:-translate-y-0.5 transition-transform"
          >
            DAVOM ETISH
          </Button>
        </div>
      </div>
    </div>
  );
}
