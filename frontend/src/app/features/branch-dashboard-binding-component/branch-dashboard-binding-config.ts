import { FormConfig } from '../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { AppValidators } from '../../core/services/validators';

export const BRANCH_DASHBOARD_BINDING_FORM: FormConfig = {
  title: 'Branch and Dashboard Binding',

  fields: [
    {
      key: 'branchId',
      label: 'Branch',
      type: 'select',
      required: true,
      searchable: true,

      optionColumns: [
        { key: 'id', title: 'ID', width: '70px' },
        { key: 'name', title: 'Branch Name' },
        { key: 'desc', title: 'Description' },
        { key: 'phone', title: 'Phone' },
        { key: 'address', title: 'Address' },
      ],
    },

    {
      key: 'conferenceCallFlag',
      label: 'Conference Call Flag',
      type: 'select',
      required: true,
      options: [
        { label: 'Active (1)', value: 1 },
        { label: 'Inactive (0)', value: 0 },
      ],
    },

    {
      key: 'effectiveDate',
      label: 'Effective Date',
      type: 'date',
      required: true,
      validators: [AppValidators.futureDate()],
    },
  ],
};

export const BRANCH_DASHBOARD_BINDING_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by branch or description',
    keys: ['branchName', 'branchDesc'],
    rules: {
      mode: 'alphanumeric',
      maxLength: 15,
      trim: true,
    },
  },

  columns: [
    {
      key: 'branchName',
      title: 'Branch',
    },
    {
      key: 'branchDesc',
      title: 'Branch Description',
    },
    {
      key: 'conferenceCallText',
      title: 'Conference Call Flag',
      filter: {
        type: 'select',
        options: [
          { label: 'Active (1)', value: 'Active' },
          { label: 'Inactive (0)', value: 'Inactive' },
        ],
      },
    },
    {
      key: 'effectiveDateDisplay',
      title: 'Effective Date',
    },
  ],

  actions: [
    { label: 'Edit', action: 'edit' },
    { label: 'Delete', action: 'delete' },
  ],

  pagination: true,
};
