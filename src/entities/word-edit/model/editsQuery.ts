import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase, type Tables } from '@/shared/api';

export const EDITS_QUERY_KEY = ['word-edits'] as const;

export type EditRow = Tables<'word_edits_view'>;

/**
 * Весь журнал разом.
 *
 * Правок ожидается несколько тысяч — по одной-три на изменённую карточку.
 * Страничной подкачки нет намеренно: таблицы нужно считать по всем шести
 * вкладкам сразу (счётчик на вкладке должен быть верным до того,
 * как её откроют), а грузить ради счётчиков вторую половину данных
 * отдельным запросом — та же работа в два приёма.
 *
 * Предел стоит не как страница, а как страховка: если журнал однажды
 * вырастет до неожиданного размера, экран должен об этом сказать,
 * а не молча показать половину.
 */
export const EDITS_LIMIT = 10000;

export interface EditsResult {
  rows: EditRow[];
  /** Упёрлись в предел — показанное неполно, и об этом надо сказать. */
  truncated: boolean;
}

export const useEdits = () =>
  useQuery({
    queryKey: EDITS_QUERY_KEY,
    queryFn: async (): Promise<EditsResult> => {
      const { data, error } = await supabase
        .from('word_edits_view')
        .select('*')
        .order('id', { ascending: false })
        .limit(EDITS_LIMIT);
      if (error) throw error;
      const rows = data ?? [];
      return { rows, truncated: rows.length === EDITS_LIMIT };
    },
  });

/**
 * Откат одной правки.
 *
 * Возвращает слову прежнее значение и помечает строку откаченной —
 * одной транзакцией на стороне базы. Править словарь из приложения
 * иначе нельзя: триггер пускает вошедшего только к отметке о сверке,
 * и откат — единственное исключение, которое он признаёт.
 */
export const useRevertEdit = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc('revert_word_edit', { p_edit: id });
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: EDITS_QUERY_KEY });
      // INFO: откат меняет само слово, поэтому список и очередь
      // показывают устаревшее, пока их не сбросить.
      void client.invalidateQueries({ queryKey: ['words'] });
      void client.invalidateQueries({ queryKey: ['learn-queue'] });
    },
  });
};
