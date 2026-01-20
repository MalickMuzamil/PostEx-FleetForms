import { FormConfig } from '../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { AppValidators } from '../../core/services/validators';

export const SUB_BRANCH_DEFINITION_FORM: FormConfig = {
  title: 'Sub-Branch Definition',

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
      ],
    },

    {
      key: 'branchName',
      label: 'Branch Name',
      type: 'readonly',
      disabled: true,
    },
    {
      key: 'branchDesc',
      label: 'Branch Description',
      type: 'readonly',
      disabled: true,
    },

    {
      key: 'subBranchName',
      label: 'Sub-Branch Name',
      type: 'select',
      required: true,
      searchable: true,
      optionColumns: [{ key: 'name', title: 'Sub-Branch Name' }],
    },
  ],
};

// ================= TABLE =================

export const SUB_BRANCH_DEFINITION_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by branch or sub-branch',
    keys: ['branchName', 'subBranchName'],
    rules: {
      mode: 'alphanumeric',
      maxLength: 20,
      trim: true,
    },
  },

  columns: [
    { key: 'subBranchId', title: 'Sub-Branch ID' },
    { key: 'branchName', title: 'Branch' },
    { key: 'subBranchName', title: 'Sub-Branch Name' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' },
    { label: 'Delete', action: 'delete' },
  ],

  pagination: true,
};
