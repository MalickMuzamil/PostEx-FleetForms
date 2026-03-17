import { TableConfig } from '../../shared/form-model/data-table-model';
import { FormConfig } from '../../shared/form-model/dynamic-form-model';

export const CALL_LOGS_FORM: FormConfig = {
    title: 'Call Logs Bulk Import',
    fields: [
        {
            key: 'bulkImport',
            label: 'Bulk Import',
            type: 'file',
            accept: '.csv,.xls,.xlsx',
            required: true,
        },
    ],
};

export const CALL_LOGS_EDIT_FORM: FormConfig = {
    title: 'Edit Call Log',
    fields: [
        { key: 'customerNumber', label: 'Customer_Number', type: 'text', required: true },
        { key: 'consigneeCellLength', label: 'Consignee_Cell_Length', type: 'text', required: true },
        { key: 'masterNo', label: 'Master_No', type: 'text', required: true },

        { key: 'agentDuration', label: 'Agent Duration', type: 'text', required: true },
        { key: 'totalDuration', label: 'Total Duration', type: 'text', required: true },

        { key: 'extension', label: 'Extension', type: 'text', required: false },
        { key: 'callResponse', label: 'Call_Response', type: 'text', required: true },
        { key: 'time', label: 'Time', type: 'date', required: true },

        { key: 'recording', label: 'Recording', type: 'text', required: false },
        {
            key: 'isArchived',
            label: 'IsArchived',
            type: 'select',
            required: true,
            options: [
                { value: 0, label: '0' },
                { value: 1, label: '1' },
            ],
        },
    ],
};

export const CALL_LOGS_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search Customer, Master, Extension, Response',
    keys: ['customerNumber', 'masterNo', 'extension', 'callResponse', 'timeDisplay'],
    rules: { mode: 'alphanumeric', maxLength: 30, trim: true },
  },

  columns: [
    {
      key: 'customerNumber',
      title: 'Customer_Number',
      filter: {
        type: 'select',
        placeholder: 'Customer_Number',
        options: [],
      },
    },

    { key: 'consigneeCellLength', title: 'Consignee_Cell_Length' },

    {
      key: 'masterNo',
      title: 'Master_No',
      filter: {
        type: 'select',
        placeholder: 'Master_No',
        options: [],
      },
    },

    { key: 'agentDurationDisplay', title: 'Agent Duration' },
    { key: 'totalDurationDisplay', title: 'Total Duration' },
    { key: 'extension', title: 'Extension' },

    {
      key: 'callResponse',
      title: 'Call_Response',
      filter: {
        type: 'select',
        placeholder: 'Call_Response',
        options: [],
      },
    },

    {
      key: 'timeDisplay',
      title: 'Time',
      filter: {
        type: 'date',
        placeholder: 'Date',
      },
    },

    { key: 'recording', title: 'Recording' },
    { key: 'isArchivedDisplay', title: 'IsArchived' }
  ],

  pagination: true,
};