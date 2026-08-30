"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { dictionaries, Language, DictionaryKey } from "../locales/dictionary";

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: DictionaryKey) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  React.useEffect(() => {
    const savedLang = localStorage.getItem("mentorsync-lang") as Language;
    if (savedLang) {
      setLangState(savedLang);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("mentorsync-lang", newLang);
  };

  const t = (key: DictionaryKey) => {
    return dictionaries[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
