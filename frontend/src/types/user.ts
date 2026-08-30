export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  department?: string;
  manager_id?: string | null;
  theme_preference?: string;
  language_preference?: string;
}
