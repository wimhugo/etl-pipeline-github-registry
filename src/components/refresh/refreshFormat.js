import { formatDistanceToNow } from 'date-fns';

export const STRATEGY_LABELS = {
  on_demand: 'On demand',
  scheduled: 'Scheduled',
  on_dependency_change: 'On dependency change',
  manual: 'Manual',
};

export const HANDLER_LABELS = {
  mirror_upstream: 'Automated mirror',
  none: 'Tracked only',
};

export const STATUS_LABELS = {
  never: 'Never refreshed',
  updated: 'Updated',
  unchanged: 'Already current',
  failed: 'Failed',
};

export const STATUS_DOT = {
  never: 'bg-muted-foreground/40',
  updated: 'bg-accent',
  unchanged: 'bg-primary/60',
  failed: 'bg-destructive',
};

export function statusOf(source) {
  return source?.last_refresh_status || 'never';
}

export function lastRefreshLabel(source) {
  if (!source?.last_refresh_at) return 'never';
  const date = new Date(source.last_refresh_at);
  if (Number.isNaN(date.getTime())) return 'never';
  return `${formatDistanceToNow(date)} ago`;
}