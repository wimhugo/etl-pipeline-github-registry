import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Filter } from 'lucide-react';
import KBConstraintList from '@/components/kbuser/KBConstraintList';

export default function KBDetailConstraints() {
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

      <KBConstraintList />
    </div>
  );
}