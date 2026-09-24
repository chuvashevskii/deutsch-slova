import type { Word } from './types';
import {
  checkDraft,
  emptyDraft,
  WORD_KINDS,
  type Finding,
  type FindingField,
  type Neighbour,
  type WordDraft,
} from './newWord';

/**
 * Правка карточки: те же поля, что заводятся руками, но только четыре.
 *
 * Перевод, помета, подсказка и примеры — всё, что человек написал сам
 * и в чём может ошибиться. Род, формы, управление, ранг, ударения
 * приезжают из Anki или выводятся правилом, и править их руками значит
 * разойтись с источником молча.
 */
export const EDITABLE_FIELDS = [
  'translation',
  'register',
  'definition',
  'examples',
] as const satisfies ReadonlyArray<FindingField>;

const EDITABLE = new Set<FindingField>(EDITABLE_FIELDS);

/** Часть речи карточки в терминах формы — по паре `pos` и `wortart`. */
export const kindOfWord = (word: Pick<Word, 'pos' | 'wortart'>) =>
  WORD_KINDS.find((k) => k.pos === word.pos && k.wortart === (word.wortart ?? null)) ??
  WORD_KINDS.find((k) => k.pos === word.pos) ??
  WORD_KINDS[0];

const pair = (values: string[] | null): [string, string] => [values?.[0] ?? '', values?.[1] ?? ''];

/**
 * Черновик из существующей карточки.
 *
 * Заполняется целиком, а не только правимыми полями: проверки примеров
 * смотрят на множественное число и управление, и без них «управление
 * заявлено, а предлога в примерах нет» просто не сработало бы.
 */
export const draftFromWord = (word: Word): WordDraft => ({
  ...emptyDraft(word.head),
  part: kindOfWord(word).value,
  translation: word.translation ?? '',
  genus: word.genus ?? '',
  singular: word.singular ?? '',
  plural: word.plural ?? '',
  komparativ: word.komparativ ?? '',
  superlativ: word.superlativ ?? '',
  rektion: word.rektion ?? [],
  formIch: word.form_ich ?? '',
  formDu: word.form_du ?? '',
  formEr: word.form_er ?? '',
  formWir: word.form_wir ?? '',
  formIhr: word.form_ihr ?? '',
  separable: Boolean((word.separable_prefix ?? '').trim()),
  separablePrefix: word.separable_prefix ?? '',
  register: word.register ?? '',
  definition: word.definition ?? '',
  examplesDe: pair(word.examples_de),
  examplesRu: pair(word.examples_ru),
});

/**
 * Находки, которые этот экран в силах снять.
 *
 * Остальные не прячутся из вредности: карточка из Anki может нарушать
 * что-то в роде или формах, и блокировать из-за этого правку опечатки
 * в переводе значило бы запереть человека в чужой ошибке.
 */
export const editFindings = (draft: WordDraft, neighbours: Neighbour[]): Finding[] =>
  checkDraft(draft, neighbours).filter((f) => EDITABLE.has(f.field));

/** Что уходит в базу: только изменившееся, чтобы журнал не пух пустыми строками. */
export const editPatch = (word: Word, draft: WordDraft) => {
  const patch: Record<string, string | string[]> = {};
  const same = (a: string[], b: string[] | null) =>
    a.length === (b ?? []).length && a.every((v, i) => v === (b ?? [])[i]);

  if (draft.translation.trim() !== (word.translation ?? '')) {
    patch.translation = draft.translation.trim();
  }
  if (draft.register.trim() !== (word.register ?? '')) patch.register = draft.register.trim();
  if (draft.definition.trim() !== (word.definition ?? '')) {
    patch.definition = draft.definition.trim();
  }

  const de = draft.examplesDe.map((s) => s.trim()).filter(Boolean);
  const ru = draft.examplesRu.map((s) => s.trim()).filter(Boolean);
  if (!same(de, word.examples_de)) patch.examples_de = de;
  if (!same(ru, word.examples_ru)) patch.examples_ru = ru;

  return patch;
};

/** Заведена ли карточка руками — только такие можно удалять. */
export const isOwnCard = (id: string) => /^my-\d+$/.test(id);
