import { useEffect, useState } from 'react';
import { virtualClock, type VirtualClockState } from '@/lib/time/virtualClock';

export function useVirtualClock() {
  const [state, setState] = useState<VirtualClockState>(virtualClock.getState());
  const [info, setInfo] = useState(virtualClock.getInfo());

  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = virtualClock.subscribe((newState) => {
      setState(newState);
      setInfo(virtualClock.getInfo());
    });

    // Update info every second if not frozen
    const interval = setInterval(() => {
      if (!state.frozenTime) {
        setInfo(virtualClock.getInfo());
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [state.frozenTime]);

  return {
    state,
    info,
    actions: {
      enable: () => virtualClock.setEnabled(true),
      disable: () => virtualClock.setEnabled(false),
      freeze: (date: Date) => virtualClock.freeze(date),
      unfreeze: () => virtualClock.unfreeze(),
      travelDays: (days: number) => virtualClock.travelDays(days),
      travelHours: (hours: number) => virtualClock.travelHours(hours),
      jumpTo: (date: Date) => virtualClock.jumpTo(date),
      reset: () => virtualClock.reset(),
      clearHistory: () => virtualClock.clearHistory()
    }
  };
}