import React, { useState, useEffect } from 'react';

export const DigitalClock: React.FC = () => {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      const timeStr = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Sao_Paulo'
      }).format(now);

      const dateStr = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Sao_Paulo'
      }).format(now);

      setTime(timeStr);
      setDate(dateStr);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-b from-black/60 to-red-950/40 backdrop-blur-md rounded-3xl shadow-[0_0_40px_rgba(220,38,38,0.15)] border border-red-500/30 animate-fade-in transform transition hover:scale-105 duration-500 group mx-4 max-w-full">
      <h2 className="text-[10px] md:text-sm font-bold text-white uppercase tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-2 drop-shadow-[0_0_5px_rgba(220,38,38,0.8)] text-center">Horário de Brasília</h2>
      <div className="text-4xl sm:text-6xl md:text-8xl font-bold text-white tabular-nums tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] group-hover:text-red-50 transition-colors">
        {time || "--:--:--"}
      </div>
      <div className="text-xs md:text-xl text-red-200/80 mt-1 md:mt-2 capitalize font-medium text-center">
        {date}
      </div>
    </div>
  );
};