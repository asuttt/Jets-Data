import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ClassSession, ClassAttendee, FacilityCheckin, MemberRecord, ActiveClassMode } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/lib/storage';
import { generateSeedClassSessions, generateSeedAttendance, seedMembers } from '@/lib/seed-data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { addMinutes, parseISO, addDays, startOfWeek, endOfWeek, format } from 'date-fns';

interface GymDataContextType {
  isLoading: boolean;
  // Class Sessions
  classSessions: ClassSession[];
  addClassSession: (session: Omit<ClassSession, 'id'>) => ClassSession;
  addClassSessions: (sessions: Omit<ClassSession, 'id'>[]) => Promise<ClassSession[]>;
  updateClassSession: (id: string, updates: Partial<ClassSession>) => Promise<void>;
  deleteClassSession: (id: string) => void;
  deleteClassSessionsInRange: (start: Date, end: Date) => Promise<void>;
  cleanupOldSessions: () => Promise<void>;
  getClassSession: (id: string) => ClassSession | undefined;
  getTodaysSessions: () => ClassSession[];

  // Class Attendees
  classAttendees: ClassAttendee[];
  addClassAttendee: (attendee: Omit<ClassAttendee, 'id'>) => ClassAttendee;
  updateClassAttendee: (id: string, updates: Partial<ClassAttendee>) => void;
  removeClassAttendee: (id: string) => void;
  getSessionAttendees: (sessionId: string) => ClassAttendee[];

  // Facility Check-ins
  facilityCheckins: FacilityCheckin[];
  addFacilityCheckin: (checkin: Omit<FacilityCheckin, 'id'>) => FacilityCheckin;
  updateFacilityCheckin: (id: string, updates: Partial<FacilityCheckin>) => void;

  // Member Directory
  memberDirectory: MemberRecord[];
  getMemberByCode: (code: string) => MemberRecord | undefined;
  addMember: (member: Omit<MemberRecord, 'id'>) => MemberRecord;

  // Active Class Mode
  activeClassMode: ActiveClassMode | null;
  startActiveClassMode: (classSessionId: string) => void;
  endActiveClassMode: () => void;
  isActiveClassModeOn: () => boolean;
  getActiveClass: () => ClassSession | null;

  // Refresh data
  refreshData: () => void;
}

const GymDataContext = createContext<GymDataContextType | undefined>(undefined);

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}

const toLocalISOString = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");
const toStorageISOString = (date: Date) => date.toISOString();

const getScheduleWindow = () => {
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const windowStart = addDays(currentWeekStart, -7);
  const windowEnd = endOfWeek(addDays(currentWeekStart, 21), { weekStartsOn: 1 });
  return { windowStart, windowEnd };
};

export function GymDataProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [useSupabase, setUseSupabase] = useState(isSupabaseConfigured);
  const [classSessions, setClassSessions] = useState<ClassSession[]>([]);
  const [classAttendees, setClassAttendees] = useState<ClassAttendee[]>([]);
  const [facilityCheckins, setFacilityCheckins] = useState<FacilityCheckin[]>([]);
  const [memberDirectory, setMemberDirectory] = useState<MemberRecord[]>([]);
  const [activeClassMode, setActiveClassMode] = useState<ActiveClassMode | null>(null);

  const initializeData = useCallback(async () => {
    setIsLoading(true);

    const loadLocalData = () => {
      let sessions = getStorageItem<ClassSession[]>(STORAGE_KEYS.CLASS_SESSIONS);
      if (!sessions || sessions.length === 0) {
        sessions = generateSeedClassSessions();
        setStorageItem(STORAGE_KEYS.CLASS_SESSIONS, sessions);
      }
      const { windowStart, windowEnd } = getScheduleWindow();
      sessions = sessions.filter((session) => {
        const date = new Date(session.startTime);
        if (Number.isNaN(date.getTime())) return false;
        return date >= windowStart && date <= windowEnd;
      });
      setClassSessions(sessions);
      setStorageItem(STORAGE_KEYS.CLASS_SESSIONS, sessions);

      let attendees = getStorageItem<ClassAttendee[]>(STORAGE_KEYS.CLASS_ATTENDEES);
      let checkins = getStorageItem<FacilityCheckin[]>(STORAGE_KEYS.FACILITY_CHECKINS);

      if (!attendees || !checkins) {
        const seedData = generateSeedAttendance(sessions);
        attendees = seedData.attendees;
        checkins = seedData.checkins;
        setStorageItem(STORAGE_KEYS.CLASS_ATTENDEES, attendees);
        setStorageItem(STORAGE_KEYS.FACILITY_CHECKINS, checkins);
      }
      setClassAttendees(attendees);
      setFacilityCheckins(checkins);

      let members = getStorageItem<MemberRecord[]>(STORAGE_KEYS.MEMBER_DIRECTORY);
      if (!members) {
        members = seedMembers;
        setStorageItem(STORAGE_KEYS.MEMBER_DIRECTORY, members);
      }
      setMemberDirectory(members);

      const acm = getStorageItem<ActiveClassMode>(STORAGE_KEYS.ACTIVE_CLASS_MODE);
      if (acm && new Date(acm.endsAt) > new Date()) {
        setActiveClassMode(acm);
      } else {
        setStorageItem(STORAGE_KEYS.ACTIVE_CLASS_MODE, null);
        setActiveClassMode(null);
      }
    };

    if (useSupabase && supabase) {
      try {
        const { windowStart, windowEnd } = getScheduleWindow();
        const windowStartIso = toStorageISOString(windowStart);
        const windowEndIso = toStorageISOString(windowEnd);

        const sessions = await supabase
          .from('class_sessions')
          .select('*')
          .gte('startTime', windowStartIso)
          .lte('startTime', windowEndIso);
        if (sessions.error) {
          throw sessions.error;
        }

        let sessionData = (sessions.data || []) as ClassSession[];
        setClassSessions(sessionData);

        let attendeeResponse = await supabase.from('class_attendees').select('*');
        let checkinResponse = await supabase.from('facility_checkins').select('*');

        if (attendeeResponse.error || checkinResponse.error) {
          throw attendeeResponse.error || checkinResponse.error;
        }

        let attendeeData = (attendeeResponse.data || []) as ClassAttendee[];
        let checkinData = (checkinResponse.data || []) as FacilityCheckin[];

        if (attendeeData.length === 0 || checkinData.length === 0) {
          const seedData = generateSeedAttendance(sessionData);
          const insertedAttendees = await supabase.from('class_attendees').insert(seedData.attendees).select('*');
          const insertedCheckins = await supabase.from('facility_checkins').insert(seedData.checkins).select('*');

          attendeeData = (insertedAttendees.data || seedData.attendees) as ClassAttendee[];
          checkinData = (insertedCheckins.data || seedData.checkins) as FacilityCheckin[];
        }

        setClassAttendees(attendeeData);
        setFacilityCheckins(checkinData);

        let membersResponse = await supabase.from('member_directory').select('*');
        if (membersResponse.error) {
          throw membersResponse.error;
        }

        let memberData = (membersResponse.data || []) as MemberRecord[];
        if (memberData.length === 0) {
          const insertedMembers = await supabase.from('member_directory').insert(seedMembers).select('*');
          memberData = (insertedMembers.data || seedMembers) as MemberRecord[];
        }
        setMemberDirectory(memberData);

        const activeModeResponse = await supabase
          .from('active_class_mode')
          .select('*')
          .eq('id', 'default')
          .maybeSingle();

        if (activeModeResponse.error) {
          throw activeModeResponse.error;
        }

        const acm = activeModeResponse.data as ActiveClassMode | null;
        if (acm && new Date(acm.endsAt) > new Date()) {
          setActiveClassMode(acm);
        } else {
          setActiveClassMode(null);
        }
      } catch (error) {
        console.warn('Supabase initialization failed, falling back to local storage.', error);
        setUseSupabase(false);
        loadLocalData();
      } finally {
        setIsLoading(false);
      }

      return;
    }

    loadLocalData();
    setIsLoading(false);
  }, [useSupabase]);

  useEffect(() => {
    void initializeData();
  }, [initializeData]);

  // Persist changes to storage
  useEffect(() => {
    if (!useSupabase && classSessions.length > 0) {
      setStorageItem(STORAGE_KEYS.CLASS_SESSIONS, classSessions);
    }
  }, [classSessions, useSupabase]);

  useEffect(() => {
    if (!useSupabase) {
      setStorageItem(STORAGE_KEYS.CLASS_ATTENDEES, classAttendees);
    }
  }, [classAttendees, useSupabase]);

  useEffect(() => {
    if (!useSupabase) {
      setStorageItem(STORAGE_KEYS.FACILITY_CHECKINS, facilityCheckins);
    }
  }, [facilityCheckins, useSupabase]);

  useEffect(() => {
    if (!useSupabase) {
      setStorageItem(STORAGE_KEYS.MEMBER_DIRECTORY, memberDirectory);
    }
  }, [memberDirectory, useSupabase]);

  // Class Session methods
  const addClassSession = useCallback((session: Omit<ClassSession, 'id'>): ClassSession => {
    const newSession = { ...session, isCancelled: session.isCancelled ?? false, isSubstitute: session.isSubstitute ?? false, id: generateId() };
    setClassSessions(prev => [...prev, newSession]);
    if (useSupabase && supabase) {
      void supabase.from('class_sessions').insert(newSession);
    }
    return newSession;
  }, [useSupabase]);

  const addClassSessions = useCallback(async (sessions: Omit<ClassSession, 'id'>[]): Promise<ClassSession[]> => {
    if (sessions.length === 0) return [];

    const prepared = sessions.map(session => ({ ...session, isCancelled: session.isCancelled ?? false, isSubstitute: session.isSubstitute ?? false, id: generateId() }));
    setClassSessions(prev => [...prev, ...prepared]);

    if (useSupabase && supabase) {
      const { data, error } = await supabase
        .from('class_sessions')
        .insert(prepared)
        .select('*');

      if (error) {
        console.warn('Failed to insert class sessions', error);
        throw error;
      }

      if (data && data.length > 0) {
        const inserted = data as ClassSession[];
        const preparedIds = new Set(prepared.map(session => session.id));
        setClassSessions(prev => {
          const remaining = prev.filter(session => !preparedIds.has(session.id));
          return [...remaining, ...inserted];
        });
        return inserted;
      }
    }

    return prepared;
  }, [useSupabase]);

  const updateClassSession = useCallback(async (id: string, updates: Partial<ClassSession>) => {
    if (useSupabase && supabase) {
      const { error } = await supabase.from('class_sessions').update(updates).eq('id', id);
      if (error) {
        throw error;
      }
    }
    setClassSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, [useSupabase]);

  const deleteClassSession = useCallback((id: string) => {
    setClassSessions(prev => prev.filter(s => s.id !== id));
    setClassAttendees(prev => prev.filter(a => a.classSessionId !== id));
    if (useSupabase && supabase) {
      void supabase.from('class_sessions').delete().eq('id', id);
      void supabase.from('class_attendees').delete().eq('classSessionId', id);
      void supabase.from('facility_checkins').delete().eq('classSessionId', id);
    }
  }, [useSupabase]);

  const deleteClassSessionsInRange = useCallback(async (start: Date, end: Date) => {
    const startIso = toStorageISOString(start);
    const endIso = toStorageISOString(end);

    if (useSupabase && supabase) {
      const { data: sessions, error: selectError } = await supabase
        .from('class_sessions')
        .select('id')
        .gte('startTime', startIso)
        .lte('startTime', endIso);
      if (selectError) {
        console.warn('Failed to load class sessions in range', selectError);
        throw selectError;
      }

      const ids = (sessions || []).map(row => row.id);
      if (ids.length === 0) return;

      const { error } = await supabase
        .from('class_sessions')
        .delete()
        .in('id', ids);
      if (error) {
        console.warn('Failed to delete class sessions in range', error);
        throw error;
      }

      await supabase.from('class_attendees').delete().in('classSessionId', ids);
      await supabase.from('facility_checkins').delete().in('classSessionId', ids);

      setClassSessions(prev => {
        const keep = prev.filter(session => {
          const date = new Date(session.startTime);
          if (Number.isNaN(date.getTime())) return false;
          return date < start || date > end;
        });
        const keepIds = new Set(keep.map(session => session.id));
        setClassAttendees(prevAtt => prevAtt.filter(att => keepIds.has(att.classSessionId)));
        setFacilityCheckins(prevCheckins => prevCheckins.filter(checkin => keepIds.has(checkin.classSessionId)));
        return keep;
      });
      return;
    }

    setClassSessions(prev => {
      const keep = prev.filter(session => {
        const date = new Date(session.startTime);
        if (Number.isNaN(date.getTime())) return false;
        return date < start || date > end;
      });
      const keepIds = new Set(keep.map(session => session.id));
      setClassAttendees(prevAtt => prevAtt.filter(att => keepIds.has(att.classSessionId)));
      setFacilityCheckins(prevCheckins => prevCheckins.filter(checkin => keepIds.has(checkin.classSessionId)));
      return keep;
    });
  }, [useSupabase]);

  const cleanupOldSessions = useCallback(async () => {
    const { windowStart } = getScheduleWindow();
    const cutoffIso = toStorageISOString(windowStart);

    if (useSupabase && supabase) {
      const { error } = await supabase
        .from('class_sessions')
        .delete()
        .lt('startTime', cutoffIso);
      if (error) {
        console.warn('Failed to cleanup old class sessions', error);
      }
      return;
    }

    setClassSessions(prev => {
      const filtered = prev.filter(session => {
        const date = new Date(session.startTime);
        if (Number.isNaN(date.getTime())) return false;
        return date >= windowStart;
      });
      const keepIds = new Set(filtered.map(session => session.id));
      setClassAttendees(prevAtt => prevAtt.filter(att => keepIds.has(att.classSessionId)));
      setFacilityCheckins(prevCheckins => prevCheckins.filter(checkin => keepIds.has(checkin.classSessionId)));
      return filtered;
    });
  }, [useSupabase]);

  const getClassSession = useCallback((id: string) => {
    return classSessions.find(s => s.id === id);
  }, [classSessions]);

  const getTodaysSessions = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return classSessions
      .filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate >= today && sessionDate < tomorrow;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [classSessions]);

  // Class Attendee methods
  const addClassAttendee = useCallback((attendee: Omit<ClassAttendee, 'id'>): ClassAttendee => {
    const newAttendee = { ...attendee, id: generateId() };
    setClassAttendees(prev => [...prev, newAttendee]);
    if (useSupabase && supabase) {
      void supabase.from('class_attendees').insert(newAttendee);
    }
    return newAttendee;
  }, [useSupabase]);

  const updateClassAttendee = useCallback((id: string, updates: Partial<ClassAttendee>) => {
    setClassAttendees(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    if (useSupabase && supabase) {
      void supabase.from('class_attendees').update(updates).eq('id', id);
    }
  }, [useSupabase]);

  const removeClassAttendee = useCallback((id: string) => {
    setClassAttendees(prev => prev.map(a => a.id === id ? { ...a, status: 'removed' } : a));
    if (useSupabase && supabase) {
      void supabase.from('class_attendees').update({ status: 'removed' }).eq('id', id);
    }
  }, [useSupabase]);

  const getSessionAttendees = useCallback((sessionId: string) => {
    return classAttendees.filter(a => a.classSessionId === sessionId && a.status !== 'removed');
  }, [classAttendees]);

  // Facility Check-in methods
  const addFacilityCheckin = useCallback((checkin: Omit<FacilityCheckin, 'id'>): FacilityCheckin => {
    const newCheckin = { ...checkin, id: generateId() };
    setFacilityCheckins(prev => [...prev, newCheckin]);
    if (useSupabase && supabase) {
      void supabase.from('facility_checkins').insert(newCheckin);
    }
    return newCheckin;
  }, [useSupabase]);

  const updateFacilityCheckin = useCallback((id: string, updates: Partial<FacilityCheckin>) => {
    setFacilityCheckins(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (useSupabase && supabase) {
      void supabase.from('facility_checkins').update(updates).eq('id', id);
    }
  }, [useSupabase]);

  // Member Directory methods
  const getMemberByCode = useCallback((code: string) => {
    return memberDirectory.find(m => m.scannedCode === code);
  }, [memberDirectory]);

  const addMember = useCallback((member: Omit<MemberRecord, 'id'>): MemberRecord => {
    const newMember = { ...member, id: generateId() };
    setMemberDirectory(prev => [...prev, newMember]);
    if (useSupabase && supabase) {
      void supabase.from('member_directory').insert(newMember);
    }
    return newMember;
  }, [useSupabase]);

  // Active Class Mode methods
  const startActiveClassMode = useCallback((classSessionId: string) => {
    const session = classSessions.find(s => s.id === classSessionId);
    if (!session) return;

    const sessionStart = parseISO(session.startTime);
    const defaultEnd = addMinutes(sessionStart, 10);
    
    const now = new Date();
    const acm: ActiveClassMode = {
      classSessionId,
      startedAt: now.toISOString(),
      endsAt: defaultEnd.toISOString(),
    };
    
    setActiveClassMode(acm);
    if (useSupabase && supabase) {
      const record = { id: 'default', ...acm };
      void supabase.from('active_class_mode').upsert(record);
    } else {
      setStorageItem(STORAGE_KEYS.ACTIVE_CLASS_MODE, acm);
    }
  }, [classSessions, useSupabase]);

  const endActiveClassMode = useCallback(() => {
    setActiveClassMode(null);
    if (useSupabase && supabase) {
      void supabase.from('active_class_mode').delete().eq('id', 'default');
    } else {
      setStorageItem(STORAGE_KEYS.ACTIVE_CLASS_MODE, null);
    }
  }, [useSupabase]);

  const isActiveClassModeOn = useCallback(() => {
    if (!activeClassMode) return false;
    return new Date(activeClassMode.endsAt) > new Date();
  }, [activeClassMode]);

  const getActiveClass = useCallback(() => {
    if (!activeClassMode || !isActiveClassModeOn()) return null;
    return classSessions.find(s => s.id === activeClassMode.classSessionId) || null;
  }, [activeClassMode, classSessions, isActiveClassModeOn]);

  const refreshData = useCallback(() => {
    void initializeData();
  }, [initializeData]);

  const value: GymDataContextType = {
    isLoading,
    classSessions,
    addClassSession,
    addClassSessions,
    updateClassSession,
    deleteClassSession,
    deleteClassSessionsInRange,
    cleanupOldSessions,
    getClassSession,
    getTodaysSessions,
    classAttendees,
    addClassAttendee,
    updateClassAttendee,
    removeClassAttendee,
    getSessionAttendees,
    facilityCheckins,
    addFacilityCheckin,
    updateFacilityCheckin,
    memberDirectory,
    getMemberByCode,
    addMember,
    activeClassMode,
    startActiveClassMode,
    endActiveClassMode,
    isActiveClassModeOn,
    getActiveClass,
    refreshData,
  };

  return <GymDataContext.Provider value={value}>{children}</GymDataContext.Provider>;
}

export function useGymData() {
  const context = useContext(GymDataContext);
  if (context === undefined) {
    throw new Error('useGymData must be used within a GymDataProvider');
  }
  return context;
}
