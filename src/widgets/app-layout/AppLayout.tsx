import { NavLink, Outlet } from 'react-router-dom';

import { useProgressSummary } from '@/entities/word';
import { useAuth } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { DAILY_SECTIONS, MOBILE_TABS, RARE_SECTIONS, type NavSection } from '@/shared/config/navigation';
import { ErrorBoundary, Skeleton } from '@/shared/ui';

// INFO: на узком экране разделы живут внизу, под большим пальцем; на
// широком — колонкой слева, где есть место для подписей и куда не надо
// тянуться. Порог 1024: ниже телефон и планшет книжкой, выше стол.

const Brand = () => (
  <span className="font-serif text-lg font-bold tracking-tight">Deutsch</span>
);

/**
 * Счётчик выученного. Пока сводка не пришла, вместо чисел стоит
 * заглушка: ноль здесь означал бы «ничего не выучено», а мы попросту
 * ещё не знаем.
 */
const Counter = ({ className }: { className?: string }) => {
  const { data: progress, isPending } = useProgressSummary();
  if (isPending) return <Skeleton className={cn('h-3 w-16', className)} />;
  return (
    <span className={cn('font-mono text-xs tabular-nums text-muted', className)}>
      {progress?.known ?? 0} / {progress?.total ?? 0}
    </span>
  );
};

const SideLink = ({ section }: { section: NavSection }) => (
  <NavLink
    to={section.to}
    end={section.end}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-[14.5px] font-medium text-muted',
        isActive ? 'bg-surface text-ink' : 'hover:text-ink',
      )
    }
  >
    <span className="w-4 text-center text-[15px] leading-none">{section.icon}</span>
    {section.label}
  </NavLink>
);

export const AppLayout = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-full lg:flex lg:justify-center lg:gap-8 lg:px-6">
      <aside className="sticky top-0 hidden h-screen w-[208px] shrink-0 flex-col gap-6 py-6 lg:flex">
        <span className="flex flex-col gap-1.5">
          <Brand />
          <Counter />
        </span>

        {/* INFO: на широком экране «Ещё» не нужно — это обход нехватки
            места внизу телефона. В колонке место есть, и прятать за
            лишним переходом три раздела не за чем. */}
        <nav className="flex flex-col gap-0.5">
          {DAILY_SECTIONS.map((section) => (
            <SideLink key={section.to} section={section} />
          ))}
          <span className="my-2 border-t border-line-soft" />
          {RARE_SECTIONS.map((section) => (
            <SideLink key={section.to} section={section} />
          ))}
        </nav>

        <span className="mt-auto flex flex-col gap-1.5 pb-2">
          <span className="truncate px-3 font-mono text-[11px] text-faint" title={user?.email}>
            {user?.email}
          </span>
          <button
            type="button"
            onClick={() => {
              signOut().catch(() => undefined);
            }}
            className="rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-muted hover:text-ink"
          >
            Выйти
          </button>
        </span>
      </aside>

      <div className="mx-auto w-full max-w-[600px] px-4 pb-24 lg:mx-0 lg:px-0 lg:pb-10">
        <header className="sticky top-0 z-20 flex items-baseline gap-3 border-b border-line-soft bg-bg py-3 lg:hidden">
          <Brand />
          <span className="flex-1" />
          <Counter />
        </header>

        {/* INFO: внутренняя граница вокруг экрана. Падение одного экрана
            не должно уносить навигацию — с неё можно уйти на рабочий. */}
        <ErrorBoundary scope="этот экран">
          <Outlet />
        </ErrorBoundary>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] lg:hidden">
        {MOBILE_TABS.map((tab) => (
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
