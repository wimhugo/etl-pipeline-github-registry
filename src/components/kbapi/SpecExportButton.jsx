import React from 'react';
import { ChevronDown, FileCode2, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { generateSwaggerSpec } from '@/lib/swaggerSpec';
import { generateSwaggerYaml } from '@/lib/swaggerYaml';

// Opens the given text in a new browser tab as a plain document.
function openSpecTab(content, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  window.open(url, '_blank', 'noopener');
  // Give the new tab time to load before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function SpecExportButton({ endpoints, serverUrl }) {
  const viewYaml = () => openSpecTab(generateSwaggerYaml(endpoints), 'text/plain');
  const viewJson = () =>
    openSpecTab(
      JSON.stringify(generateSwaggerSpec(endpoints, { serverUrl }), null, 2),
      'application/json'
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1.5">
          <FileCode2 className="w-3.5 h-3.5" />
          Export spec
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={viewYaml}>
          <FileCode2 className="w-3.5 h-3.5" />
          View YAML in new tab
        </DropdownMenuItem>
        <DropdownMenuItem onClick={viewJson}>
          <FileJson className="w-3.5 h-3.5" />
          View JSON in new tab
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}