import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/shared/api';
import { cn } from '@/shared/lib/cn';

/**
 * Озвучка одной формы. Ничего не рисует, если записи нет: пустая кнопка
 * обещала бы звук, которого не существует.
 *
 * Звучит всегда только одна форма. Нажали вторую, пока играет первая, —
 * первая обрывается: два наложившихся слова не разобрать.
 */
let playing: HTMLAudioElement | null = null;

interface AudioButtonProps {
  /** Путь внутри бакета audio. */
  path: string | null;
  /** Что озвучивается — уходит в подпись для чтения с экрана. */
  label: string;
}

export const AudioButton = ({ path, label }: AudioButtonProps) => {
  const [state, setState] = useState<'idle' | 'playing' | 'failed'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // INFO: уход со страницы посреди звука не должен оставлять его играть.
  useEffect(
    () => () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (playing === audioRef.current) playing = null;
      }
    },
    [],
  );

  if (!path) return null;

  const play = () => {
    if (playing && playing !== audioRef.current) playing.pause();

    if (!audioRef.current) {
      const url = supabase.storage.from('audio').getPublicUrl(path).data.publicUrl;
      const audio = new Audio(url);
      audio.addEventListener('ended', () => setState('idle'));
      audio.addEventListener('error', () => setState('failed'));
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    playing = audio;
    audio.currentTime = 0;
    setState('playing');
    // INFO: промах здесь — обычное дело: файла может не быть в хранилище.
    // Молчать об этом нельзя, иначе кнопка выглядит сломанной.
    audio.play().catch(() => setState('failed'));
  };

  return (
    <button
      type="button"
      onClick={play}
      disabled={state === 'failed'}
      aria-label={state === 'failed' ? `${label}: запись не открылась` : `Послушать: ${label}`}
      title={state === 'failed' ? 'Запись не открылась' : undefined}
      className={cn(
        'shrink-0 touch-manipulation rounded-md p-1.5 text-faint transition-colors',
        state === 'playing' && 'text-ink',
        state === 'failed' && 'opacity-40',
        state === 'idle' && 'hover:text-muted',
      )}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d="M8.5 2.5 5 5.5H2.5v5H5l3.5 3v-11Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {state !== 'failed' ? (
          <path
            d="M11 5.5a3.5 3.5 0 0 1 0 5M13 3.5a6.5 6.5 0 0 1 0 9"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            className={cn(state === 'playing' && 'animate-pulse')}
          />
        ) : (
          <path d="M11.5 6 15 9.5M15 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
};
