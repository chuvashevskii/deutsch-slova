import { Link } from 'react-router-dom';

import { useIsAdmin } from '@/entities/settings';
import { useAuth } from '@/features/auth';
import { ADMIN_SECTIONS, RARE_SECTIONS } from '@/shared/config/navigation';

/**
 * Раздел «Ещё» — второй этаж навигации, и только для телефона. Внизу
 * экрана помещаются четыре вкладки, а разделов шесть; ежедневные —
 * «Учить», «Слова», «Статистика» — должны оставаться в одно касание,
 * редкое уходит сюда.
 *
 * На широком экране этой страницы в навигации нет: боковая колонка
 * показывает все разделы сразу, и лишний переход там ничего не решает.
 * Сам адрес остаётся рабочим — по нему можно прийти из закладки.
 */
export const MorePage = () => {
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const links = isAdmin ? [...RARE_SECTIONS, ...ADMIN_SECTIONS] : RARE_SECTIONS;

  return (
    <div className="py-4">
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        {links.map((link) => (
          <li key={link.to} className="border-b border-line-soft last:border-b-0">
            <Link to={link.to} className="flex items-baseline gap-3 px-4 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{link.label}</span>
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
