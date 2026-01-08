export type FilterType = 'text' | 'select' | 'dateRange';

export type InputMode = 'any' | 'letters' | 'numbers' | 'alphanumeric';

export interface InputRules {
  mode?: InputMode; 
  maxLength?: number; 
  trim?: boolean; 
}

export interface TableColumn {
  key: string;
  title: string;

  filter?: {
    type: FilterType;
    placeholder?: string;

    // ✅ NEW
    rules?: InputRules;

    options?: { label: string; value: any }[];

    predicate?: (row: any, filterValue: any) => boolean;
  };
}

export interface TableAction {
  label: string;
  action: 'edit' | 'delete';
}

export interface TableConfig {
  columns: TableColumn[];
  actions?: TableAction[];
  pagination?: boolean;

  globalSearch?: {
    placeholder?: string;
    keys?: string[];

    // ✅ NEW
    rules?: InputRules;
  };
}
