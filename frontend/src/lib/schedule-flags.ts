import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type ScheduleFlagStatus = 'confirmed' | 'dismissed';

type LocalFlags = Record<string, ScheduleFlagStatus>;

export async function getScheduleFlag(weekStart: string): Promise<ScheduleFlagStatus | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('schedule_flags')
      .select('status')
      .eq('week_start', weekStart)
      .maybeSingle();
    if (error) {
      console.warn('Failed to load schedule flag', error);
      return null;
    }
    return (data?.status as ScheduleFlagStatus | undefined) ?? null;
  }

  const flags = getStorageItem<LocalFlags>(STORAGE_KEYS.SCHEDULE_FLAGS) || {};
  return flags[weekStart] ?? null;
}

export async function setScheduleFlag(weekStart: string, status: ScheduleFlagStatus): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('schedule_flags')
      .upsert({ week_start: weekStart, status, updated_at: new Date().toISOString() });
    if (error) {
      console.warn('Failed to save schedule flag', error);
    }
    return;
  }

  const flags = getStorageItem<LocalFlags>(STORAGE_KEYS.SCHEDULE_FLAGS) || {};
  flags[weekStart] = status;
  setStorageItem(STORAGE_KEYS.SCHEDULE_FLAGS, flags);
}
