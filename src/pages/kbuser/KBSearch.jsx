import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import KBPolicyList from '@/components/kbuser/KBPolicyList';

export default function KBSearch() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Policy Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and explore policies from the knowledge base data files.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 bg-muted/50 text-sm"
          placeholder="Filter by label or id…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <KBPolicyList searchQuery={searchQuery} />
    </div>
  );
}