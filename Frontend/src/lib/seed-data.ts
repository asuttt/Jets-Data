import { ClassSession, User, MemberRecord, ClassAttendee, FacilityCheckin } from '@/types';
import { addDays, setHours, setMinutes, format, subDays } from 'date-fns';

// Generate a unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Demo users
export const seedUsers: User[] = [
  { id: 'admin-1', name: 'Alex Owner', email: 'admin@gymfront.local', role: 'admin' },
  { id: 'staff-1', name: 'Sam Staff', email: 'staff@gymfront.local', role: 'staff' },
];

// Demo member directory
export const seedMembers: MemberRecord[] = [
  { id: generateId(), scannedCode: 'MEM001', memberDisplayName: 'John Smith' },
  { id: generateId(), scannedCode: 'MEM002', memberDisplayName: 'Jane Doe' },
  { id: generateId(), scannedCode: 'MEM003', memberDisplayName: 'Mike Johnson' },
  { id: generateId(), scannedCode: 'MEM004', memberDisplayName: 'Sarah Williams' },
  { id: generateId(), scannedCode: 'MEM005', memberDisplayName: 'Chris Brown' },
  { id: generateId(), scannedCode: 'MEM006', memberDisplayName: 'Emily Davis' },
  { id: generateId(), scannedCode: 'MEM007', memberDisplayName: 'David Wilson' },
  { id: generateId(), scannedCode: 'MEM008', memberDisplayName: 'Lisa Anderson' },
];

// Generate a week of class sessions
export function generateSeedClassSessions(): ClassSession[] {
  const sessions: ClassSession[] = [];
  const today = new Date();
  
  const classTemplates = [
    { name: 'Morning Yoga', instructor: 'Maya Chen', hour: 6, minute: 30, duration: 60, capacity: 20 },
    { name: 'HIIT Blast', instructor: 'Jake Torres', hour: 7, minute: 30, duration: 45, capacity: 15 },
    { name: 'Spin Class', instructor: 'Rachel Green', hour: 9, minute: 0, duration: 45, capacity: 25 },
    { name: 'Pilates Fundamentals', instructor: 'Maya Chen', hour: 10, minute: 30, duration: 50, capacity: 12 },
    { name: 'Strength Training', instructor: 'Jake Torres', hour: 12, minute: 0, duration: 60, capacity: 20 },
    { name: 'Power Yoga', instructor: 'Maya Chen', hour: 17, minute: 30, duration: 75, capacity: 20 },
    { name: 'Evening HIIT', instructor: 'Jake Torres', hour: 18, minute: 30, duration: 45, capacity: 15 },
    { name: 'Stretch & Recover', instructor: 'Rachel Green', hour: 19, minute: 30, duration: 30, capacity: 25 },
  ];

  // Generate sessions for the past 3 days and next 4 days
  for (let dayOffset = -3; dayOffset <= 4; dayOffset++) {
    const date = addDays(today, dayOffset);
    const dayOfWeek = date.getDay();
    
    // Skip some classes on weekends
    const templatesForDay = dayOfWeek === 0 || dayOfWeek === 6 
      ? classTemplates.filter((_, i) => i % 2 === 0)
      : classTemplates;

    templatesForDay.forEach(template => {
      const startTime = setMinutes(setHours(date, template.hour), template.minute);
      sessions.push({
        id: generateId(),
        name: template.name,
        instructor: template.instructor,
        startTime: startTime.toISOString(),
        durationMinutes: template.duration,
        capacity: template.capacity,
      });
    });
  }

  return sessions;
}

// Generate sample attendance data for past classes
export function generateSeedAttendance(sessions: ClassSession[]): { attendees: ClassAttendee[], checkins: FacilityCheckin[] } {
  const attendees: ClassAttendee[] = [];
  const checkins: FacilityCheckin[] = [];
  const now = new Date();
  
  // Only add attendance for past sessions
  const pastSessions = sessions.filter(s => new Date(s.startTime) < now);
  
  pastSessions.forEach(session => {
    const sessionDate = new Date(session.startTime);
    const attendeeCount = Math.floor(Math.random() * (session.capacity * 0.8)) + 3;
    
    // Add ClassPass attendees (30-50% of attendance)
    const classpassCount = Math.floor(attendeeCount * (0.3 + Math.random() * 0.2));
    const classpassNames = ['Alex Rivera', 'Jordan Lee', 'Taylor Morgan', 'Casey Quinn', 'Morgan Blake', 'Riley Chen'];
    
    for (let i = 0; i < Math.min(classpassCount, classpassNames.length); i++) {
      attendees.push({
        id: generateId(),
        classSessionId: session.id,
        attendeeDisplayName: classpassNames[i],
        source: 'classpass',
        checkedInAt: new Date(sessionDate.getTime() + Math.random() * 20 * 60000).toISOString(),
        status: 'checked_in',
      });
    }
    
    // Add member attendees (40-60% of attendance)
    const memberCount = Math.floor(attendeeCount * (0.4 + Math.random() * 0.2));
    const shuffledMembers = [...seedMembers].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(memberCount, shuffledMembers.length); i++) {
      const member = shuffledMembers[i];
      const checkinTime = new Date(sessionDate.getTime() - (Math.random() * 15 * 60000));
      
      attendees.push({
        id: generateId(),
        classSessionId: session.id,
        attendeeDisplayName: member.memberDisplayName,
        source: 'member',
        checkedInAt: checkinTime.toISOString(),
        status: 'checked_in',
        isInferred: true,
      });
      
      checkins.push({
        id: generateId(),
        userId: null,
        memberDisplayName: member.memberDisplayName,
        scannedCode: member.scannedCode,
        checkedInAt: checkinTime.toISOString(),
        checkinType: 'class',
        classSessionId: session.id,
      });
    }
    
    // Add walk-ins (5-15% of attendance)
    const walkinCount = Math.floor(attendeeCount * (0.05 + Math.random() * 0.1));
    const walkinNames = ['Guest Visitor', 'Trial Member', 'Drop-in'];
    
    for (let i = 0; i < Math.min(walkinCount, 2); i++) {
      attendees.push({
        id: generateId(),
        classSessionId: session.id,
        attendeeDisplayName: `${walkinNames[i % walkinNames.length]} ${i + 1}`,
        source: 'walkin',
        checkedInAt: new Date(sessionDate.getTime() + Math.random() * 10 * 60000).toISOString(),
        status: 'checked_in',
        note: i === 0 ? 'First-time visitor' : undefined,
      });
    }
  });
  
  // Add some open gym checkins
  for (let dayOffset = -3; dayOffset <= 0; dayOffset++) {
    const date = addDays(now, dayOffset);
    const openGymCount = Math.floor(Math.random() * 10) + 5;
    
    for (let i = 0; i < openGymCount; i++) {
      const member = seedMembers[Math.floor(Math.random() * seedMembers.length)];
      const hour = Math.floor(Math.random() * 12) + 6; // 6am to 6pm
      const checkinTime = setMinutes(setHours(date, hour), Math.floor(Math.random() * 60));
      
      checkins.push({
        id: generateId(),
        userId: null,
        memberDisplayName: member.memberDisplayName,
        scannedCode: member.scannedCode,
        checkedInAt: checkinTime.toISOString(),
        checkinType: 'open_gym',
        classSessionId: null,
      });
    }
  }
  
  return { attendees, checkins };
}
