import { determinerForms } from '../model/determiner';

const GENUS_CLASS = ['text-masculine', 'text-feminine', 'text-neuter'] as const;
const GENUS_NAME = ['мужской род', 'женский род', 'средний род'] as const;

/**
 * Окончания определителя по родам — строкой под словом.
 *
 * Цвет тот же, что у рода существительного на всей карточке: мужской
 * синий, женский малиновый, средний зелёный. Другого способа показать
 * род, не дублируя артикль, в колоде нет, и заводить второй ради семи
 * слов не за чем.
 *
 * Основа стоит обычным цветом, окончание — цветом рода: видно, что
 * меняется только хвост. Кавычек вокруг окончания нет: дефис и так
 * говорит, что это хвост, а лишние знаки в строке из трёх слогов
 * читаются хуже самих окончаний.
 *
 * У `derselbe` хвост не меняется — меняется артикль внутри слова, —
 * и там показываются формы целиком.
 */
export const DeterminerEndings = ({ head }: { head: string }) => {
  const pattern = determinerForms(head);
  if (!pattern) return null;

  const { stem, endings, forms } = pattern;
  const items = stem ? endings : forms;

  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[14px]">
      <span className="mr-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
        по родам
      </span>
      {stem ? <span className="font-serif text-muted">{stem}</span> : null}
      {items.map((item, index) => (
        <span key={GENUS_NAME[index]} className="whitespace-nowrap">
          <span
            title={GENUS_NAME[index]}
            className={`font-serif font-semibold ${GENUS_CLASS[index]}`}
          >
            {item}
          </span>
          {index < items.length - 1 ? <span className="ml-1.5 text-faint">·</span> : null}
        </span>
      ))}
    </p>
  );
};
