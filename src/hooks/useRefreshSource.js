import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Runs one refresh task and refreshes the cards. Shared by the registry page
// and the dashboard task list so both report results the same way.
export default function useRefreshSource() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (source) => {
      const res = await base44.functions.invoke('refreshSource', { source_id: source.id });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['refreshSources'] });
      if (data?.status === 'updated') {
        queryClient.invalidateQueries({ queryKey: ['previewApiSourceFile'] });
      }
      toast({
        title: data?.status === 'updated' ? 'Source updated' : 'Already current',
        description: data?.status === 'updated'
          ? `${data.name} was refreshed from its upstream copy.`
          : `${data?.name} matches its upstream copy.`,
      });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['refreshSources'] });
      toast({
        title: 'Refresh failed',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      });
    },
  });
}