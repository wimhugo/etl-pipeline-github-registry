import React, { useState } from 'react';
import KBPolicyList from '@/components/kbuser/KBPolicyList';
import PolicyFilterBar from '@/components/kbpolicy/PolicyFilterBar';
import PolicyFilterSidePanel from '@/components/kbpolicy/PolicyFilterSidePanel';

export default function KBSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [dataByField, setDataByField] = useState({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // KBPolicyList calls this with { odrlTypes, statuses } — we remap to a field-keyed map
  const handleDataReady = ({ odrlTypes, statuses }) => {
    setDataByField({ odrl_type: odrlTypes, status: statuses });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Policy Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and explore policies from the knowledge base data files.
        </p>
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