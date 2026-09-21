import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        ink: 'hsl(var(--ink))',
        muted: 'hsl(var(--muted))',
        faint: 'hsl(var(--faint))',
        line: 'hsl(var(--line))',
        'line-soft': 'hsl(var(--line-soft))',
        focus: 'hsl(var(--focus))',
        // род существительного
        masculine: 'hsl(var(--masculine))',
        feminine: 'hsl(var(--feminine))',
        neuter: 'hsl(var(--neuter))',
        // падежи в управлении глагола
        akkusativ: 'hsl(var(--akkusativ))',
        dativ: 'hsl(var(--dativ))',
        genitiv: 'hsl(var(--genitiv))',
        preposition: 'hsl(var(--preposition))',
        gold: 'hsl(var(--gold))',
        separable: 'hsl(var(--separable))',
        ok: 'hsl(var(--ok))',
        bad: 'hsl(var(--bad))',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
        ipa: ['"Charis IPA"', '"Charis SIL"', '"Gentium Plus"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [animate],
} satisfies Config;
