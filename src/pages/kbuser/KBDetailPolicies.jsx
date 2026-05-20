import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import KBPolicyList from '@/components/kbuser/KBPolicyList';
import PolicyFilterBar from '@/components/kbpolicy/PolicyFilterBar';
import PolicyFilterSidePanel from '@/components/kbpolicy/PolicyFilterSidePanel';

export default function KBDetailPolicies() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [dataByField, setDataByField] = useState({});
  const [countsByField, setCountsByField] = useState({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const handleDataReady = ({ odrlTypes, statuses, countsByField: counts = {} }) => {
    setDataByField({ odrl_type: odrlTypes, status: statuses });
    setCountsByField(counts);
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          to="/kb-user/dashboard"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-primary/10">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All policies from the knowledge base — expand each entry for full detail.
          </p>
        </div>
      </div>

      <PolicyFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        filterPanelOpen={filterPanelOpen}
        onToggleFilterPanel={() => setFilterPanelOpen(o => !o)}
      />

      <div className="flex gap-4 items-start">
        {filterPanelOpen && (
          <PolicyFilterSidePanel
            filters={filters}
            onFiltersChange={setFilters}
            dataByField={dataByField}
            countsByField={countsByField}
          />
        )}
        <div className="flex-1 min-w-0">
          <KBPolicyList
            searchQuery={searchQuery}
            advancedFilters={filters}
            onDataReady={handleDataReady}
          />
        </div>
      </div>
    </div>
  );
}