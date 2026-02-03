import { useGymData } from '@/contexts/GymDataContext';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ActiveClassBanner() {
  const { activeClassMode, getActiveClass, endActiveClassMode, isActiveClassModeOn } = useGymData();
  
  const activeClass = getActiveClass();
  
  if (!activeClass || !isActiveClassModeOn()) {
    return null;
  }

  const startTime = parseISO(activeClass.startTime);

  return (
    <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 bg-primary-foreground rounded-full animate-pulse" />
        <span className="font-semibold">
          Active Class: {format(startTime, 'h:mm a')} {activeClass.name}
        </span>
        <span className="text-primary-foreground/80">
          with {activeClass.instructor}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-primary-foreground/80">
          Barcode scans will be attributed to this class
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={endActiveClassMode}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          End Check-in
        </Button>
      </div>
    </div>
  );
}
