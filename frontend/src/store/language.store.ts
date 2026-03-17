import { create } from 'zustand';
import { translations, Lang, T } from '../i18n/translations';

interface LangStore {
  lang: Lang;
  t: T;
  toggle: () => void;
}

export const useLangStore = create<LangStore>((set) => ({
  lang: 'ru',
  t: translations.ru,
  toggle: () =>
    set((s) => {
      const next: Lang = s.lang === 'ru' ? 'en' : 'ru';
      return { lang: next, t: translations[next] };
    }),
}));
