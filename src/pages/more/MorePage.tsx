import { Link } from 'react-router-dom';

import { useAuth } from '@/features/auth';

/**
 * Раздел «Ещё» — второй этаж навигации. Внизу экрана помещаются три-четыре
 * вкладки, а разделов больше, и ежедневные — «Учить», «Слова»,
 * «Статистика» — должны оставаться в одно касание. Редкое уходит сюда.
 */
const LINKS = [
  { to: '/settings', title: 'Настройки', hint: 'Что спрашивать, сколько новых слов в день, псевдоним' },
  { to: '/feedback', title: 'Обращения', hint: 'Что не так с карточкой — общий список' },
  { to: '/backlog', title: 'Бэклог слов', hint: 'Слова на будущее: предложить и посмотреть чужие' },
] as const;

export const MorePage = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="py-4">
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        {LINKS.map((link) => (
          <li key={link.to} className="border-b border-line-soft last:border-b-0">
            <Link to={link.to} className="flex items-baseline gap-3 px-4 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{link.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{link.hint}</span>
              </span>
              <span aria-hidden="true" className="text-faint">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 px-1 font-mono text-[11px] text-faint">{user?.email}</p>
      <button
        type="button"
        onClick={() => {
          signOut().catch(() => undefined);
        }}
        className="mt-2 w-full rounded-lg border border-line px-4 py-3 text-[14px] font-semibold text-muted"
      >
        Выйти
      </button>
    </div>
  );
};
