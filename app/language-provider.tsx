"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

type Language = "ar" | "en";

type LanguageContextValue = {
  language: Language;
  isArabic: boolean;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<Language>("ar");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("trynda-language");
    const nextLanguage: Language =
      savedLanguage === "en" ? "en" : "ar";

    setLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr";
  }, []);

  function toggleLanguage() {
    const nextLanguage: Language = language === "ar" ? "en" : "ar";

    setLanguage(nextLanguage);
    window.localStorage.setItem("trynda-language", nextLanguage);
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr";
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        isArabic: language === "ar",
        toggleLanguage,
      }}
    >
      {children}
      <button
        type="button"
        className="language-switcher"
        onClick={toggleLanguage}
        aria-label={
          language === "ar"
            ? "Switch to English"
            : "التبديل إلى العربية"
        }
      >
        {language === "ar" ? "English" : "العربية"}
      </button>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
}
