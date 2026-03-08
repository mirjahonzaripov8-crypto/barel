import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveFeaturesByPlan, getTestingFeaturesByPlan, type CustomFeature } from '@/lib/store';
import { Sparkles, Info, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SafePage from './SafePage';
import DynamicFeatureRenderer, { type FeatureUIConfig } from '@/components/DynamicFeatureRenderer';

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

// Cache generated configs in localStorage
function getCachedConfig(featureId: string): FeatureUIConfig | null {
  try {
    const cached = localStorage.getItem(`barel_feat_config_${featureId}`);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

function setCachedConfig(featureId: string, config: FeatureUIConfig) {
  localStorage.setItem(`barel_feat_config_${featureId}`, JSON.stringify(config));
}

export default function CustomFeaturePage() {
  const { featureId } = useParams<{ featureId: string }>();
  const { company } = useAuth();
  const [aiConfig, setAiConfig] = useState<FeatureUIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allFeatures = company ? [
    ...getActiveFeaturesByPlan(company.plan as any),
    ...getTestingFeaturesByPlan(company.plan as any),
  ] : [];
  const feature = allFeatures.find(f => f.id === featureId);

  useEffect(() => {
    if (!feature || !featureId) return;
    
    // Skip if has built component
    const built = findBuiltComponent(feature);
    if (built) return;

    // Check cache first
    const cached = getCachedConfig(featureId);
    if (cached) {
      setAiConfig(cached);
      return;
    }

    // Generate via AI
    setLoading(true);
    setError(null);

    supabase.functions.invoke('generate-feature-ui', {
      body: { prompt: feature.prompt },
    }).then(({ data, error: fnError }) => {
      if (fnError) {
        console.error('AI generation error:', fnError);
        setError('AI funksiya yaratishda xatolik');
        setLoading(false);
        return;
      }
      if (data?.config) {
        setAiConfig(data.config);
        setCachedConfig(featureId, data.config);
      } else if (data?.error) {
        setError(data.error);
      }
      setLoading(false);
    });
  }, [featureId, feature?.id]);

  if (!company) return null;

  if (!feature) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Info className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Funksiya topilmadi</h2>
        <p className="text-muted-foreground text-sm">Bu funksiya mavjud emas yoki sizning tarifingiz uchun faol emas.</p>
      </div>
    );
  }

  // Check built component first
  const BuiltComponent = findBuiltComponent(feature);
  if (BuiltComponent) {
    return <BuiltComponent />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">AI funksiya yaratmoqda...</h2>
        <p className="text-muted-foreground text-sm">Prompt asosida interfeys generatsiya qilinmoqda</p>
      </div>
    );
  }

  // AI-generated config available
  if (aiConfig && featureId) {
    return <DynamicFeatureRenderer config={aiConfig} featureId={featureId} />;
  }

  // Error or fallback
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Info className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Xatolik</h2>
        <p className="text-muted-foreground text-sm mb-4">{error}</p>
        <button
          className="text-primary underline text-sm"
          onClick={() => {
            localStorage.removeItem(`barel_feat_config_${featureId}`);
            window.location.reload();
          }}
        >
          Qayta urinib ko'rish
        </button>
      </div>
    );
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
    </div>
  );
}
