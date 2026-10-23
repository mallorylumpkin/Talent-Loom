/** Shape returned by every form Server Action (used with React's useActionState). */
export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

export const initialFormState: FormState = {};
