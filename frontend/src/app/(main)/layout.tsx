"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LayoutDashboard, Users, Settings, UserCircle, LogOut, FileBarChart, MonitorDot, Moon, Sun, Droplets, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme, Theme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import api, { getErrorMessage } from "@/lib/api";
import type { Language } from "@/locales/dictionary";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, token, logout, isAuthenticated, isInitialized, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isInitialized, router]);

  // Apply user preferences on initial load
  useEffect(() => {
    if (user && isInitialized) {
      if (user.theme_preference && user.theme_preference !== theme) {
        setTheme(user.theme_preference as Theme);
      }
      if (user.language_preference && user.language_preference !== lang) {
        setLang(user.language_preference as Language);
      }
    }
  }, [user?.id, isInitialized]); // only run when user object loads

  // Sync preferences back to DB when they change
  useEffect(() => {
    if (!user || !token || !isInitialized) return;
    const timer = setTimeout(() => {
      api.put(`/users/${user.id}/preferences`, { theme_preference: theme, language_preference: lang })
        .then(() => {
          const stored = localStorage.getItem("mentor_sync_user");
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.theme_preference = theme;
            parsed.language_preference = lang;
            localStorage.setItem("mentor_sync_user", JSON.stringify(parsed));
          }
        })
        .catch(err => console.error("Failed to sync preferences:", getErrorMessage(err)));
    }, 1500); // Debounce
    return () => clearTimeout(timer);
  }, [theme, lang, user?.id, token]);

  const isActive = (path: string) => pathname.startsWith(path);

  if (!isInitialized || !user) return null; // Or a loading spinner

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col z-10">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2 tracking-tight">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            MentorSync
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          
          {hasRole("admin") && (
            <div className="px-4">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-3">{t('adminWorkspace')}</p>
              <nav className="space-y-1">
                <Link href="/admin/users" className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${isActive('/admin/users') ? 'bg-secondary text-secondary-foreground' : 'text-foreground hover:bg-muted'}`}>
                  <ShieldAlert className={`w-5 h-5 ${isActive('/admin/users') ? 'text-primary' : 'text-muted-foreground'}`} />
                  {t('userManagement')}
                </Link>
              </nav>
            </div>
          )}

          {(hasRole("admin") || hasRole("mentor")) && (
            <div className="px-4">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-3">{t('seniorWorkspace')}</p>
              <nav className="space-y-1">
                <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${isActive('/dashboard') ? 'bg-secondary text-secondary-foreground' : 'text-foreground hover:bg-muted'}`}>
                  <LayoutDashboard className={`w-5 h-5 ${isActive('/dashboard') ? 'text-primary' : 'text-muted-foreground'}`} />
                  {t('teamDashboard')}
                </Link>
                <Link href="/criteria" className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${isActive('/criteria') ? 'bg-secondary text-secondary-foreground' : 'text-foreground hover:bg-muted'}`}>
                  <Settings className={`w-5 h-5 ${isActive('/criteria') ? 'text-primary' : 'text-muted-foreground'}`} />
                  {t('slaConfig')}
                </Link>
                <Link href="/reports" className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${isActive('/reports') ? 'bg-secondary text-secondary-foreground' : 'text-foreground hover:bg-muted'}`}>
                  <FileBarChart className={`w-5 h-5 ${isActive('/reports') ? 'text-primary' : 'text-muted-foreground'}`} />
                  {t('teamReports')}
                </Link>
              </nav>
            </div>
          )}

          {(hasRole("admin") || hasRole("mentee")) && (
            <div className="px-4">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-3">{t('juniorWorkspace')}</p>
              <nav className="space-y-1">
                <Link href="/my-dashboard" className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${isActive('/my-dashboard') ? 'bg-secondary text-secondary-foreground' : 'text-foreground hover:bg-muted'}`}>
                  <MonitorDot className={`w-5 h-5 ${isActive('/my-dashboard') ? 'text-primary' : 'text-muted-foreground'}`} />
                  {t('myDashboard')}
                </Link>
              </nav>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-border">
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors w-full">
            <LogOut className="w-5 h-5" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Topbar */}
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 shrink-0 z-20">
          <h2 className="text-lg font-bold text-foreground">MentorSync Platform</h2>
          <div className="flex items-center gap-6">
            
            {/* Theme Switcher */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-full border border-border">
              <button onClick={() => setTheme('light')} className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Sun className="w-4 h-4" />
              </button>
              <button onClick={() => setTheme('dark')} className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Moon className="w-4 h-4" />
              </button>
              <button onClick={() => setTheme('ocean')} className={`p-1.5 rounded-full transition-colors ${theme === 'ocean' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Droplets className="w-4 h-4" />
              </button>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-full border border-border">
              <button onClick={() => setLang('en')} className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${lang === 'en' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>EN</button>
              <button onClick={() => setLang('th')} className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${lang === 'th' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>TH</button>
            </div>

            <div className="flex items-center gap-3 border-l border-border pl-6">
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-foreground">{user.name}</span>
                <span className="text-xs text-muted-foreground uppercase">{user.roles?.join(", ")}</span>
              </div>
              <UserCircle className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
