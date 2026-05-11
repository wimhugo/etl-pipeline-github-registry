import React from 'react';
import { Construction } from 'lucide-react';

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
        <Construction className="w-8 h-8 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          {description || 'This feature is coming soon. Stay tuned for updates.'}
        </p>
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
        Coming Soon
      </div>
    </div>
  );
}