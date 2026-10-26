/** Shape returned by every form Server Action (used with React's useActionState). */
export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** Extra result data for the form to show (e.g. a generated setup link). */
  data?: Record<string, string>;
}

export const initialFormState: FormState = {};
