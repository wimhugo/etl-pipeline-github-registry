import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function StandaloneBundleButton() {
  const [isBuilding, setIsBuilding] = useState(false);
  const { toast } = useToast();

  const download = async () => {
    setIsBuilding(true);
    try {
      const response = await base44.functions.invoke('bundleStandaloneApi', {});
      const data = response.data || {};
      if (data.error) throw new Error(data.error);

      const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename || 'openrel-api-standalone.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'Bundle downloaded',
        description: `${data.file_count} files (${data.endpoint_count} endpoints). Unzip it and serve the folder — see README.`,
      });
    } catch (error) {
      toast({
        title: 'Could not build the bundle',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={isBuilding} className="gap-1.5">
      {isBuilding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {isBuilding ? 'Bundling…' : 'Download standalone bundle'}
    </Button>
  );
}