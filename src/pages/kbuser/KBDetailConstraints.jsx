import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Filter, Search } from 'lucide-react';
import KBConstraintList from '@/components/kbuser/KBConstraintList';
import { Input } from '@/components/ui/input';

export default function KBDetailConstraints() {
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
        <div className="p-2 rounded-lg bg-purple-400/10">
          <Filter className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Constraints</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All constraints from the knowledge base — expand each entry for the full definition.
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

      <KBConstraintList searchQuery={searchQuery} />
    </div>
  );
}