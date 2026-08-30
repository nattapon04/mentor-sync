# MentorSync: Coding Conventions & Best Practices

To ensure the project is maintainable, scalable, and follows enterprise-grade standards, all development must strictly adhere to the following conventions.

## 1. Project Workflow Constraints
- **Strict Workflow:** Think/Plan -> User Approval -> Execute -> Review/Walkthrough.
- **No Direct Execution:** The agent MUST NOT execute code changes until the user explicitly approves the implementation plan.
- **Convention Adherence:** Every implementation must strictly follow these structural and naming conventions.

## 2. Backend (Go + Fiber)
We will follow a simplified **Clean Architecture / Standard Go Layout**.

### Folder Structure
```text
backend/
├── cmd/
│   └── api/             # Entry point (main.go)
├── internal/
│   ├── handlers/        # HTTP controllers (Fiber handlers)
│   ├── services/        # Business logic & SLA calculations
│   ├── repositories/    # Database queries & transactions
│   ├── models/          # Structs & DB entities
│   └── middleware/      # Fiber middlewares (Auth, Logger)
├── pkg/                 # Shared utilities (e.g., config, error handling)
└── database/            # Migrations & DB connection setup
```

### Naming Conventions
- **Files/Folders:** `snake_case` (e.g., `user_handler.go`, `sla_service.go`)
- **Exported Structs/Functions:** `PascalCase` (e.g., `GetUserByID`, `UserService`)
- **Internal Variables:** `camelCase` (e.g., `dbConn`, `menteeId`)
- **Interfaces:** Should end with `er` (e.g., `UserRepository`, `SLAEvaluator`)

---

## 2. Frontend (Next.js 15+ App Router)
We will follow Next.js Best Practices with a modular component approach.

### Folder Structure
```text
frontend/src/
├── app/                 # Next.js App Router (Routes & Layouts only)
│   ├── (auth)/          # Route groups for logical separation
│   ├── dashboard/
│   └── mentees/
├── components/          
│   ├── ui/              # Reusable generic UI (Buttons, Inputs, Cards)
│   ├── features/        # Feature-specific components (e.g., SLAForm.tsx)
│   └── layout/          # Sidebar, Topbar, MainLayout
├── lib/                 # Utility functions (e.g., formatters, API clients)
├── hooks/               # Custom React hooks
├── types/               # TypeScript interfaces & types
└── store/               # Global state (if needed e.g. Zustand)
```

### Naming Conventions
- **App Router Folders:** `kebab-case` (e.g., `mentee-details`)
- **React Components (Files & Functions):** `PascalCase` (e.g., `SlaForm.tsx`, `Sidebar.tsx`)
- **Utility Files (Hooks/Libs):** `camelCase` (e.g., `useAuth.ts`, `formatDate.ts`)
- **Types/Interfaces:** `PascalCase` (e.g., `UserType`, `SlaRule`)

---

## 3. General Practices
- **No Magic Strings:** Use constants or enums for statuses (e.g., `STATUS_GREEN`, `ROLE_JUNIOR`).
- **Database:** Use `snake_case` for all table and column names in PostgreSQL.
- **Error Handling:** Always check and return errors in Go. In TS, use `try-catch` appropriately.

## 4. Internationalization (i18n) Strategy
- **Backend Driven:** Key business logic messages, error messages, and dynamic data statuses should be translated and sent from the Backend (Go) via API response.
- **Frontend Fallback:** The Frontend will only store static UI text translations (e.g., Button labels, Navigation menus). Any missing translations from the API should be caught and mapped by the Frontend.
