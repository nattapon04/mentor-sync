import { ReactElement } from "react";
import { render } from "@testing-library/react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";

// Mirrors the provider nesting in src/app/layout.tsx, so a page under test sees the same
// context tree it gets in the real app.
export function renderWithProviders(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>{ui}</AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
