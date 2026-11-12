import { createContext, useContext, type ReactNode } from "react";
import en from "./en.json";
import fil from "./fil.json";

export type Lang = "en" | "fil";
export type TKey = keyof typeof en;

const dicts: Record<Lang, Record<string, string>> = { en, fil };

interface I18n {
  lang: Lang;
  t: (k: TKey) => string;
}

const I18nContext = createContext<I18n>({ lang: "en", t: (k) => en[k] });

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = (k: TKey) => dicts[lang][k] ?? en[k] ?? k;
  return <I18nContext.Provider value={{ lang, t }}>{children}</I18nContext.Provider>;
}

export const useT = () => useContext(I18nContext);

/** Fills `{name}`-style placeholders. */
export const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
