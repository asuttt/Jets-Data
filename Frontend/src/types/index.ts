// User & Auth Types
export type UserRole = 'admin' | 'staff' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  keytag_value?: string | null;
  keytag_format?: string | null;
  keytag_updated_at?: string | null;
}

// Class Session Types
export interface ClassSession {
  isCancelled?: boolean;
  isSubstitute?: boolean;
  substituteInstructor?: string;
  externalEventId?: string;
  calendarId?: string;
  lastSyncedAt?: string;
  source?: 'manual' | 'ics' | 'google';
  id: string;
  name: string;
  instructor: string;
  startTime: string; // ISO date string
  durationMinutes: number;
  capacity: number;
}

// Check-in Types
export type CheckinType = 'open_gym' | 'class';
export type AttendeeSource = 'classpass' | 'member' | 'walkin';
export type AttendeeStatus = 'checked_in' | 'removed';

export interface FacilityCheckin {
  id: string;
  userId: string | null;
  memberDisplayName: string;
  scannedCode: string | null;
  checkedInAt: string; // ISO date string
  checkinType: CheckinType;
  classSessionId: string | null;
}

export interface ClassAttendee {
  id: string;
  classSessionId: string;
  attendeeDisplayName: string;
  source: AttendeeSource;
  checkedInAt: string | null;
  status: AttendeeStatus;
  isInferred?: boolean; // For member scans during Active Class Mode
  note?: string; // For walk-ins (trial/guest)
}

// Member Directory
export interface MemberRecord {
  id: string;
  scannedCode: string;
  memberDisplayName: string;
}

// Active Class Mode State
export interface ActiveClassMode {
  id?: string;
  classSessionId: string;
  startedAt: string;
  endsAt: string;
}

// Analytics Types
export interface DailyStats {
  date: string;
  totalCheckins: number;
  uniqueMembers: number;
  hourlyDistribution: Record<number, number>;
}

export interface ClassPerformance {
  classSessionId: string;
  className: string;
  instructor: string;
  startTime: string;
  capacity: number;
  attendanceCount: number;
  percentFilled: number;
  breakdown: {
    classpass: number;
    member: number;
    walkin: number;
  };
}
