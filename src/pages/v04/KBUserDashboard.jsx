import React from 'react';

// The V0.4 KB User Dashboard surfaces the OpenREL Policy Wizard as a live
// "Sample Application". The wizard itself is the standalone, self-contained
// build in /public/OpenREL_Wizard.html — it reads the curated Policy Index
// live from the repo via the public API, so this frame always shows the
// latest merged data with no extra wiring here.

export default function KBUserDashboard() {
  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sample Application</h1>
          <p className="text-sm text-muted-foreground mt-1">
            OpenREL Policy Wizard — standalone, client-side ODRL reference tree reading the live Policy Index.
          </p>
        </div>
        <a
          href="/OpenREL_Wizard.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          Open in new tab ↗
        </a>
      </div>
      <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden bg-background">
        <iframe
          src="/OpenREL_Wizard.html"
          title="OpenREL Policy Wizard — Sample Application"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}