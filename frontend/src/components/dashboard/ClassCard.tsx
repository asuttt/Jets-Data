import { useGymData } from '@/contexts/GymDataContext';
import { ClassSession } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, addMinutes, isPast, isFuture, isWithinInterval } from 'date-fns';
import { Play, Users, Clock, User, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClassCardProps {
  session: ClassSession;
  onStartCheckin: (sessionId: string) => void;
  onViewRoster: (sessionId: string) => void;
  hideActions?: boolean;
  showRosterButton?: boolean;
  showStartCheckin?: boolean;
}

export default function ClassCard({
  session,
  onStartCheckin,
  onViewRoster,
  hideActions = false,
  showRosterButton = true,
  showStartCheckin = true,
}: ClassCardProps) {
  const { getSessionAttendees, activeClassMode, isActiveClassModeOn } = useGymData();
  
  const attendees = getSessionAttendees(session.id);
  const checkedInCount = attendees.filter(a => a.checkedInAt).length;
  const startTime = parseISO(session.startTime);
  const endTime = addMinutes(startTime, session.durationMinutes);
  
  const now = new Date();
  const isActive = activeClassMode?.classSessionId === session.id && isActiveClassModeOn();
  const isPastClass = isPast(endTime);
  const isUpcoming = isFuture(addMinutes(startTime, -30));
  const isInProgress = isWithinInterval(now, { start: startTime, end: endTime });
  
  // Can start check-in 30 minutes before class
  const canStartCheckin = !isPastClass && !isActive && isWithinInterval(now, { 
    start: addMinutes(startTime, -30), 
    end: addMinutes(startTime, 10) 
  });

  return (
    <div
      className={cn(
        "border rounded-lg p-4 transition-all bg-muted/30",
        (session.isSubstitute || session.substituteInstructor) && !session.isCancelled && "bg-[#B7AAED]/25 border-[#B7AAED]/70",
        isActive && "ring-2 ring-primary bg-primary/5 border-primary",
        isPastClass && "opacity-60",
        session.isCancelled && "border-destructive/50",
        !isActive && !isPastClass && !session.isCancelled && "hover:border-primary/50"
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className={cn("font-semibold text-lg truncate", session.isCancelled && "line-through text-destructive/80")}>
              {session.name}
            </h3>
            {session.isCancelled && (
              <Badge className="bg-destructive/15 text-destructive">[CANCELLED]</Badge>
            )}
            {isActive && (
              <Badge className="bg-primary text-primary-foreground animate-pulse-slow">
                Active Check-in
              </Badge>
            )}
            {isPastClass && (
              <Badge variant="secondary">Completed</Badge>
            )}
            {isInProgress && !isActive && (
              <Badge variant="outline">In Progress</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className={cn("flex items-center gap-1", session.isCancelled && "line-through text-destructive/70")}>
            <Clock className="h-4 w-4" />
            {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
          </span>
          <span className={cn("flex items-center gap-1", session.isCancelled && "line-through text-destructive/70")}>
            <User className="h-4 w-4" />
            {session.instructor}
            {(session.isSubstitute || session.substituteInstructor) && !session.isCancelled && (
              <span className="ml-2 text-xs font-semibold text-[#4B3AA8]">[SUBSTITUTE]</span>
            )}
          </span>
        </div>

        {!hideActions && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {showStartCheckin && canStartCheckin && !isActive && (
                <Button
                  onClick={() => onStartCheckin(session.id)}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Check-in
                </Button>
              )}

              {showRosterButton && (
                <Button
                  variant={isActive ? "default" : "outline"}
                  onClick={() => onViewRoster(session.id)}
                >
                  {isActive ? 'Manage Roster' : 'View Roster'}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-1 text-lg font-semibold">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className={cn(
                    checkedInCount >= session.capacity && "text-destructive"
                  )}>
                    {checkedInCount}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground">{session.capacity}</span>
                </div>
                <p className="text-xs text-muted-foreground">checked in</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attendance breakdown */}
      {!hideActions && attendees.length > 0 && (
        <div className="mt-3 pt-3 border-t flex gap-4 text-sm">
          <span className="text-muted-foreground">
            ClassPass: {attendees.filter(a => a.source === 'classpass').length}
          </span>
          <span className="text-muted-foreground">
            Members: {attendees.filter(a => a.source === 'member').length}
            {attendees.some(a => a.source === 'member' && a.isInferred) && (
              <span className="text-xs ml-1">(inferred)</span>
            )}
          </span>
          <span className="text-muted-foreground">
            Walk-ins: {attendees.filter(a => a.source === 'walkin').length}
          </span>
        </div>
      )}
    </div>
  );
}
