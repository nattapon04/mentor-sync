"use client";

import { Users, Globe, Sun, Moon, Droplets } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import api, { getErrorMessage } from "@/lib/api";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function Login() {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.user, data.token);
    } catch (error) {
      setErrorMsg(getErrorMessage(error, t('loginFailedDefault')));
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-foreground/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top right controls */}
      <div className="absolute top-6 right-6 flex items-center gap-4 z-20">
        <div className="flex items-center gap-1 bg-card/50 backdrop-blur-md p-1 rounded-full border border-border shadow-sm">
          <button onClick={() => setTheme('light')} className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Sun className="w-4 h-4" />
          </button>
          <button onClick={() => setTheme('dark')} className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Moon className="w-4 h-4" />
          </button>
          <button onClick={() => setTheme('ocean')} className={`p-1.5 rounded-full transition-colors ${theme === 'ocean' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Droplets className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-card/50 backdrop-blur-md px-2 py-1 rounded-full border border-border shadow-sm">
          <Globe className="w-4 h-4 text-muted-foreground mr-1" />
          <button onClick={() => setLang('en')} className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${lang === 'en' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>EN</button>
          <button onClick={() => setLang('th')} className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${lang === 'th' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>TH</button>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center text-foreground">
          <div className="p-3 bg-card border border-border shadow-sm rounded-2xl">
            <Users className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
          {t('signIn')}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-card/70 backdrop-blur-xl py-8 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-border sm:rounded-3xl sm:px-10">
          
          <form className="space-y-6" onSubmit={handleLogin}>
            <ErrorBanner message={errorMsg || null} />
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-1.5">{t('emailAddressLabel')}</label>
              <input
                id="email"
                type="email"
                required
                className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 text-foreground"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-1.5">{t('passwordLabel')}</label>
              <input
                id="password"
                type="password"
                required
                className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 text-foreground"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? t('signingIn') : t('signInBtn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
