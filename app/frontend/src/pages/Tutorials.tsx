/**
 * S — Tutorials / Materiale video.
 *
 * Static list, no real video hosting yet — a placeholder thumbnail + play
 * icon that honestly says "coming soon" rather than pretending a video
 * exists (see Section E7/E8.8 of the RN migration plan). Two device/vehicle
 * tutorials from the Figma handoff were intentionally left out — they
 * describe the deferred physical-device feature (Section E8).
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface TutorialItem {
  id: string;
  title: string;
  description: string;
}

const Tutorials: React.FC = () => {
  const { t } = useTranslation('tutorials');
  const [tab, setTab] = useState<'video' | 'text'>('video');
  const items = t('items', { returnObjects: true }) as TutorialItem[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" aria-hidden="true" />
          {t('title')}
        </h1>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('video')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'video' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {t('videoTab')}
        </button>
        <button
          type="button"
          onClick={() => setTab('text')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'text' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {t('textTab')}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex gap-3 p-4">
              {tab === 'video' ? (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Play className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
              ) : null}
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                {tab === 'video' && (
                  <Badge variant="secondary" className="mt-2">
                    {t('videoComingSoon')}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Tutorials;
