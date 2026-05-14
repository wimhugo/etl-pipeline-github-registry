import React, { useState } from 'react';
import KBPolicyList from '@/components/kbuser/KBPolicyList';
import PolicyFilterBar from '@/components/kbpolicy/PolicyFilterBar';

export default function KBSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({ odrlTypes: [], statuses: [] });

  return (
    <div className="space-y-5 max-w-4xl">
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
        onFiltersChange={setFilters}
        odrlTypes={filterOptions.odrlTypes}
        statuses={filterOptions.statuses}
      />

      <KBPolicyList
        searchQuery={searchQuery}
        advancedFilters={filters}
        onDataReady={setFilterOptions}
      />
    </div>
  );
}