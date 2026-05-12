import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Search } from 'lucide-react';
import KBActionList from '@/components/kbuser/KBActionList';
import { Input } from '@/components/ui/input';

export default function KBDetailActions() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-5 max-w-4xl">
      <Link
        to="/kb-user/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Dashboard
      </Link>

      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-yellow-400/10">
          <Zap className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Actions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All actions from the knowledge base — expand each entry for the full definition.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Filter by label or ID…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <KBActionList searchQuery={searchQuery} />
    </div>
  );
}