import { NavLink, Outlet } from 'react-router-dom';

import { useProgressSummary } from '@/entities/word';
import { cn } from '@/shared/lib/cn';

// INFO: внизу помещаются четыре вкладки. Ежедневное остаётся в одно касание,
// редкое — настройки, обращения, бэклог — уходит на второй этаж, в «Ещё».
const TABS = [
  { to: '/', label: 'Учить', icon: '◆', end: true },
  { to: '/words', label: 'Слова', icon: '☰', end: false },
  { to: '/stats', label: 'Статистика', icon: '▤', end: false },
  { to: '/more', label: 'Ещё', icon: '⋯', end: false },
] as const;

export const AppLayout = () => {
  // INFO: шапка висит на каждом экране, поэтому здесь нельзя тянуть словарь:
  // два числа приходят готовым агрегатом.
  const { data: progress } = useProgressSummary();

  return (
    <div className="mx-auto min-h-full max-w-[600px] px-4 pb-24">
      <header className="sticky top-0 z-20 flex items-baseline gap-3 border-b border-line-soft bg-bg py-3">
        <span className="font-serif text-lg font-bold tracking-tight">
          Zwei<span className="text-feminine">tausend</span>
        </span>
        <span className="flex-1" />
        <span className="font-mono text-xs tabular-nums text-muted">
          {progress?.known ?? 0} / {progress?.total ?? 0}
        </span>
      </header>

      <Outlet />

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)]">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 border-t-2 border-transparent px-1 pb-3 pt-2.5 text-xs font-medium text-muted',
                isActive && 'border-t-ink text-ink',
              )
            }
          >
            <span className="text-[17px] leading-none">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
