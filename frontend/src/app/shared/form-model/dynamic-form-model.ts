import { Observable } from 'rxjs';

export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'date'
  | 'textarea'
  | 'checkbox'
  | 'readonly'
  | 'file'
  | 'status';

export interface SelectColumn {
  key: string;
  title: string;
  width?: string;
}

export interface SelectOption {
  label: string;
  value: any;
  searchText?: string;
  meta?: Record<string, any>;
}

export interface FormField {
  key: string;
  label: string;
  type: FieldType;

  required?: boolean;
  disabled?: boolean;

  defaultValue?: any;
  searchable?: boolean;

  options?: SelectOption[];
  options$?: Observable<SelectOption[]>;

  optionColumns?: SelectColumn[];

  dependsOn?: string;
  validators?: any[];

  updateOn?: 'change' | 'blur' | 'submit';

  loading?: boolean;
  accept?: string;
  enabledWhen?: string[];
  disabledWhen?: string[];
  mask?: 'SHORT_CODE_3_2' | 'ALPHA5_ROMAN' | 'AAA_AAA' | 'AAA_AAA_AAA';
  maskPrefixKey?: string;

  /* reusable layout / UI helpers */
  fullWidth?: boolean;

  /* for status field */
  statusOptions?: { label: string; value: any }[];
}

export interface FormConfig {
  title: string;
  mode?: 'create' | 'update' | 'view';
  fields: FormField[];
}