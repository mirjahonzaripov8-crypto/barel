import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveFeaturesByPlan, getTestingFeaturesByPlan, type CustomFeature } from '@/lib/store';
import { Sparkles, Info } from 'lucide-react';
import SafePage from './SafePage';

// Registry: map feature title keywords to built components
const BUILT_FEATURES: Record<string, React.ComponentType> = {
  'seyf': SafePage,
};

function findBuiltComponent(feature: CustomFeature): React.ComponentType | null {
  const titleLower = feature.title.toLowerCase();
  for (const [keyword, Component] of Object.entries(BUILT_FEATURES)) {
    if (titleLower.includes(keyword)) return Component;
  }
  return null;
}

export default function CustomFeaturePage() {
  const { featureId } = useParams<{ featureId: string }>();
  const { company } = useAuth();
  if (!company) return null;

  const allFeatures = [
    ...getActiveFeaturesByPlan(company.plan as any),
    ...getTestingFeaturesByPlan(company.plan as any),
  ];
  const feature = allFeatures.find(f => f.id === featureId);

  if (!feature) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Info className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Funksiya topilmadi</h2>
        <p className="text-muted-foreground text-sm">Bu funksiya mavjud emas yoki sizning tarifingiz uchun faol emas.</p>
      </div>
    );
  }

  // Check if there's a built component for this feature
  const BuiltComponent = findBuiltComponent(feature);
  if (BuiltComponent) {
    return <BuiltComponent />;
  }

  // Fallback: show feature info
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{feature.title}</h1>
            {feature.status === 'testing' && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-warning/10 text-warning font-medium">🧪 Test rejim</span>
            )}
          </div>
        </div>
        {feature.description && (
          <p className="text-muted-foreground text-sm mt-1">{feature.description}</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Funksiya tafsilotlari
        </h2>
        <div className="bg-secondary/50 rounded-lg p-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{feature.prompt}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold text-foreground mb-3">Ma'lumotlar</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Holati</p>
            <p className="font-medium text-foreground">{feature.status === 'active' ? '✅ Faol' : '🧪 Test'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tarif</p>
            <p className="font-medium text-foreground">{feature.targetPlan}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Qo'shilgan sana</p>
            <p className="font-medium text-foreground">{new Date(feature.created_at).toLocaleDateString('uz-UZ')}</p>
          </div>
          {feature.deployedAt && (
            <div>
              <p className="text-muted-foreground">Deploy sanasi</p>
              <p className="font-medium text-foreground">{new Date(feature.deployedAt).toLocaleDateString('uz-UZ')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
