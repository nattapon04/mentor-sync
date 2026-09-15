export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  department?: string;
  /** @deprecated Use mentors[] instead — kept for backward compatibility. */
  manager_id?: string | null;
  /** Mentors assigned to this user via the mentorships junction table. */
  mentors?: User[];
  /** Mentees this user is mentoring via the mentorships junction table. */
  mentees?: User[];
  theme_preference?: string;
  language_preference?: string;
}
