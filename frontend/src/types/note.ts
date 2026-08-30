export interface GeneralNote {
  id: string;
  note_type: string;
  message: string;
  created_at: string;
  author?: { name: string };
}
