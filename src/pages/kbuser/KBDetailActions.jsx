import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import KBActionList from '@/components/kbuser/KBActionList';

export default function KBDetailActions() {
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

      <KBActionList />
    </div>
  );
}