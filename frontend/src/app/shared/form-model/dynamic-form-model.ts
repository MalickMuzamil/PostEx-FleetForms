import { Observable } from 'rxjs';

export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'date'
  | 'textarea'
  | 'checkbox'
  | 'readonly'
  | 'file';

export interface SelectColumn {
  key: string; // meta object key
  title: string; // header title
  width?: string; // optional
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

  // control update strategy: 'change' (per keystroke), 'blur' (on blur), or 'submit'
  updateOn?: 'change' | 'blur' | 'submit';

  loading?: boolean;
  accept?: string; // ".csv,.xls,.xlsx"
  enabledWhen?: string[];
  disabledWhen?: string[];
  mask?: 'SHORT_CODE_3_2';
}

export interface FormConfig {
  title: string;
  mode?: 'create' | 'update' | 'view';
  fields: FormField[];
}
