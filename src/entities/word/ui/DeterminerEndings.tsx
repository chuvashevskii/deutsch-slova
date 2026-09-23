import { determinerForms } from '../model/determiner';

const GENUS_CLASS = ['text-masculine', 'text-feminine', 'text-neuter'] as const;
const GENUS_NAME = ['мужской род', 'женский род', 'средний род'] as const;

/**
 * Определитель во всех трёх родах — строкой под словом.
 *
 * Цвет тот же, что у рода существительного на всей карточке: мужской
 * синий, женский малиновый, средний зелёный. Другого способа назвать
 * род, не дублируя артикль, в колоде нет.
 *
 * Сперва показывались окончания — `jed` и `-er · -e · -es`. Слово
 * целиком читается быстрее: глаз берёт `jede` как слово, а не
 * складывает его из основы и хвоста, и три образца — der-слова,
 * ein-слова и `derselbe` — выглядят одинаково, без прочерков
 * и исключений.
 *
 * Окончания при этом остались в данных: тест складывает основу
 * с окончанием и сверяет с формой. Это и есть то, что не даёт
 * формам разъехаться с правилом.
 */
export const DeterminerEndings = ({ head }: { head: string }) => {
  const pattern = determinerForms(head);
  if (!pattern) return null;

  const { forms } = pattern;

  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[14px]">
      <span className="mr-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
        по родам
      </span>
      {forms.map((item, index) => (
        <span key={GENUS_NAME[index]} className="whitespace-nowrap">
          <span
            title={GENUS_NAME[index]}
            className={`font-serif font-semibold ${GENUS_CLASS[index]}`}
          >
            {item}
          </span>
          {index < forms.length - 1 ? <span className="ml-1.5 text-faint">·</span> : null}
        </span>
      ))}
    </p>
  );
};
