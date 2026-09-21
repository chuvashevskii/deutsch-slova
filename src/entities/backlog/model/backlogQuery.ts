import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/shared/api';

export const BACKLOG_QUERY_KEY = ['backlog'] as const;

export type BacklogState = 'new' | 'added' | 'rejected';

export interface BacklogRow {
  id: number;
  user_id: string;
  word: string;
  translation: string;
  note: string;
  state: BacklogState;
  created_at: string;
  nickname: string;
}

export const BACKLOG_STATE_LABEL: Record<BacklogState, string> = {
  new: 'в очереди',
  added: 'заведено',
  rejected: 'отклонено',
};

export const useBacklog = () =>
  useQuery({
    queryKey: BACKLOG_QUERY_KEY,
    queryFn: async (): Promise<BacklogRow[]> => {
      const { data, error } = await supabase
        .from('backlog')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;

      const rows = data ?? [];
      const authors = [...new Set(rows.map((row) => row.user_id))];
      const names = new Map<string, string>();
      if (authors.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, nickname')
          .in('user_id', authors);
        for (const profile of profiles ?? []) names.set(profile.user_id, profile.nickname);
      }
      return rows.map((row) => ({
        ...row,
        state: row.state as BacklogState,
        nickname: names.get(row.user_id) ?? 'Аноним',
      }));
    },
  });

/**
 * Есть ли уже такое слово — в колоде или в чужих предложениях.
 *
 * Проверка двойная намеренно. В колоде 1462 слова, наизусть их никто
 * не помнит, а список общий: без проверки он наполнялся бы тем, что уже
 * есть, и одним и тем же от разных людей.
 */
export interface DuplicateCheck {
  inDeck: { id: string; head: string; translation: string } | null;
  inBacklog: { word: string; nickname: string } | null;
}

export const useCheckDuplicate = (word: string) => {
  const trimmed = word.trim();
  return useQuery({
    queryKey: [...BACKLOG_QUERY_KEY, 'duplicate', trimmed.toLowerCase()],
    enabled: trimmed.length >= 2,
    queryFn: async (): Promise<DuplicateCheck> => {
      const [deck, backlog] = await Promise.all([
        supabase.from('words').select('id, head, translation').ilike('head', trimmed).limit(1),
        supabase.from('backlog').select('word, user_id').ilike('word', trimmed).limit(1),
      ]);
      let inBacklog: DuplicateCheck['inBacklog'] = null;
      if (backlog.data?.length) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('user_id', backlog.data[0].user_id)
          .maybeSingle();
        inBacklog = { word: backlog.data[0].word, nickname: profile?.nickname ?? 'Аноним' };
      }
      return { inDeck: deck.data?.[0] ?? null, inBacklog };
    },
  });
};

export const useAddToBacklog = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      word: string;
      translation: string;
      note: string;
    }) => {
      const { error } = await supabase.from('backlog').insert({
        user_id: input.userId,
        word: input.word.trim(),
        translation: input.translation.trim(),
        note: input.note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: BACKLOG_QUERY_KEY });
    },
  });
};

/** Состояние строки меняет администратор — это стережёт триггер в базе. */
export const useSetBacklogState = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, state }: { id: number; state: BacklogState }) => {
      const { error } = await supabase.from('backlog').update({ state }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: BACKLOG_QUERY_KEY });
    },
  });
};

export const useDeleteBacklog = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('backlog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: BACKLOG_QUERY_KEY });
    },
  });
};
