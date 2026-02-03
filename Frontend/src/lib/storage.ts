// LocalStorage-based persistence layer
// Can be swapped for Supabase later

const STORAGE_KEYS = {
  USERS: 'gym_users',
  CLASS_SESSIONS: 'gym_class_sessions',
  FACILITY_CHECKINS: 'gym_facility_checkins',
  CLASS_ATTENDEES: 'gym_class_attendees',
  MEMBER_DIRECTORY: 'gym_member_directory',
  ACTIVE_CLASS_MODE: 'gym_active_class_mode',
  SCHEDULE_FLAGS: 'gym_schedule_flags',
  CURRENT_USER: 'gym_current_user',
} as const;

export function getStorageItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to remove from localStorage:', error);
  }
}

export { STORAGE_KEYS };
