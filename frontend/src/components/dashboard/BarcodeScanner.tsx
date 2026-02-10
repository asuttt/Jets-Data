import { useState, useRef, useEffect, useCallback } from 'react';
import { useGymData } from '@/contexts/GymDataContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Scan, Undo2, Dumbbell } from 'lucide-react';

interface BarcodeScannerProps {
  onScanComplete?: () => void;
}

export default function BarcodeScanner({ onScanComplete }: BarcodeScannerProps) {
  const [scanInput, setScanInput] = useState('');
  const [lastScan, setLastScan] = useState<{
    id: string;
    name: string;
    classId: string | null;
    checkinId: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    getMemberByCode, 
    addMember,
    addFacilityCheckin, 
    updateFacilityCheckin,
    addClassAttendee,
    removeClassAttendee,
    activeClassMode,
    getActiveClass,
    isActiveClassModeOn 
  } = useGymData();

  // Intentionally avoid auto-focus to prevent mobile keyboard pop-up.

  const handleScan = useCallback(() => {
    const code = scanInput.trim();
    if (!code) return;

    // Look up member or create new record
    let member = getMemberByCode(code);
    let memberName = member?.memberDisplayName || `Member ${code}`;
    
    if (!member) {
      // Auto-add unknown barcodes to directory
      member = addMember({
        scannedCode: code,
        memberDisplayName: memberName,
      });
    }

    const now = new Date().toISOString();
    const activeClass = getActiveClass();
    const isActiveMode = isActiveClassModeOn();

    // Create facility check-in
    const checkin = addFacilityCheckin({
      userId: null,
      memberDisplayName: memberName,
      scannedCode: code,
      checkedInAt: now,
      checkinType: isActiveMode && activeClass ? 'class' : 'open_gym',
      classSessionId: isActiveMode && activeClass ? activeClass.id : null,
    });

    // If Active Class Mode is on, also add to class roster
    let classAttendeeId: string | null = null;
    if (isActiveMode && activeClass) {
      const attendee = addClassAttendee({
        classSessionId: activeClass.id,
        attendeeDisplayName: memberName,
        source: 'member',
        checkedInAt: now,
        status: 'checked_in',
        isInferred: true,
      });
      classAttendeeId = attendee.id;

      toast.success(
        <div className="flex items-center gap-2">
          <span>✓ {memberName} checked in for <strong>{activeClass.name}</strong></span>
        </div>,
        {
          duration: 4000,
        }
      );
    } else {
      toast.success(`✓ ${memberName} checked in (Open Gym)`, {
        duration: 3000,
      });
    }

    setLastScan({
      id: classAttendeeId || checkin.id,
      name: memberName,
      classId: activeClass?.id || null,
      checkinId: checkin.id,
    });
    
    setScanInput('');
    inputRef.current?.focus();
    onScanComplete?.();
  }, [scanInput, getMemberByCode, addMember, addFacilityCheckin, addClassAttendee, getActiveClass, isActiveClassModeOn, onScanComplete]);

  const handleUndo = useCallback(() => {
    if (!lastScan) return;

    if (lastScan.classId) {
      removeClassAttendee(lastScan.id);
      updateFacilityCheckin(lastScan.checkinId, {
        checkinType: 'open_gym',
        classSessionId: null,
      });
      toast.info(`Removed ${lastScan.name} from class roster (still checked in as Open Gym)`);
    }
    setLastScan(null);
  }, [lastScan, removeClassAttendee, updateFacilityCheckin]);

  const handleMarkOpenGym = useCallback(() => {
    if (!lastScan || !lastScan.classId) return;

    removeClassAttendee(lastScan.id);
    updateFacilityCheckin(lastScan.checkinId, {
      checkinType: 'open_gym',
      classSessionId: null,
    });
    toast.info(`Marked ${lastScan.name} as Open Gym`);
    setLastScan(null);
  }, [lastScan, removeClassAttendee, updateFacilityCheckin]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan member barcode"
            className="pl-10 h-11 text-base font-mono"
            autoComplete="off"
          />
        </div>
        <Button onClick={handleScan} size="default" className="h-11 px-5">
          Check In
        </Button>
      </div>

      {/* Quick actions for last scan */}
      {lastScan && lastScan.classId && (
        <div className="flex gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground flex-1">
            Last: <strong>{lastScan.name}</strong>
          </span>
          <Button variant="outline" size="sm" onClick={handleUndo} className="gap-1">
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={handleMarkOpenGym} className="gap-1">
            <Dumbbell className="h-4 w-4" />
            Mark as Open Gym
          </Button>
        </div>
      )}
    </div>
  );
}
