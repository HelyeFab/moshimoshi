'use client';

import { useState, useEffect } from 'react';

interface CountdownLabels {
  days: string;
  hours: string;
  mins: string;
  secs: string;
  complete: string;
}

interface CountdownTimerProps {
  targetDate: Date;
  className?: string;
  onComplete?: () => void;
  labels?: CountdownLabels;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const defaultLabels: CountdownLabels = {
  days: 'Days',
  hours: 'Hours',
  mins: 'Mins',
  secs: 'Secs',
  complete: "We're Live!",
};

export function CountdownTimer({ targetDate, className = '', onComplete, labels = defaultLabels }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const l = { ...defaultLabels, ...labels };

  useEffect(() => {
    const calculateTimeLeft = (): TimeLeft => {
      const difference = targetDate.getTime() - new Date().getTime();

      if (difference <= 0) {
        setIsComplete(true);
        onComplete?.();
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (isComplete) {
    return (
      <div className={`text-center ${className}`}>
        <div className="text-2xl sm:text-3xl font-bold text-green-500 animate-pulse">
          {l.complete}
        </div>
      </div>
    );
  }

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-primary-500 to-japanese-sakura rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tabular-nums">
            {String(value).padStart(2, '0')}
          </span>
        </div>
        <div className="absolute -inset-1 bg-gradient-to-br from-primary-500/20 to-japanese-sakura/20 rounded-2xl blur-lg -z-10" />
      </div>
      <span className="mt-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );

  return (
    <div className={`flex items-center justify-center gap-2 sm:gap-4 md:gap-6 ${className}`}>
      <TimeBlock value={timeLeft.days} label={l.days} />
      <div className="text-2xl sm:text-3xl font-bold text-primary-500 self-start mt-4 sm:mt-6">:</div>
      <TimeBlock value={timeLeft.hours} label={l.hours} />
      <div className="text-2xl sm:text-3xl font-bold text-primary-500 self-start mt-4 sm:mt-6">:</div>
      <TimeBlock value={timeLeft.minutes} label={l.mins} />
      <div className="text-2xl sm:text-3xl font-bold text-primary-500 self-start mt-4 sm:mt-6">:</div>
      <TimeBlock value={timeLeft.seconds} label={l.secs} />
    </div>
  );
}
