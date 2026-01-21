import { FormConfig } from '../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { AppValidators } from '../../core/services/validators';

export const SUB_BRANCH_DEFINITION_FORM: FormConfig = {
  title: 'Sub-Branch Definition',

  fields: [
    // ================= BRANCH =================
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

    // ================= AUTO FILLED (READONLY) =================
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

    // ================= SUB BRANCH NAME =================
    {
      key: 'subBranchName',
      label: 'Sub-Branch Name',
      type: 'text',
      required: true,
      mask: 'AAA_AAA_AAA',
      maskPrefixKey: 'branchId',
      validators: [AppValidators.maxLen(20)],

      updateOn: 'change',
    },

    // ================= DESCRIPTION =================
    {
      key: 'subBranchDesc',
      label: 'Description',
      type: 'text',
      required: true,
      validators: [
        AppValidators.alphaSpace(50),
        AppValidators.notOnlyNumbers(),
      ],
      updateOn: 'change',
    },
  ],
};

export const SUB_BRANCH_DEFINITION_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by branch or sub-branch',
    keys: ['branchName', 'subBranchName'],
    rules: {
      mode: 'alphanumeric',
      maxLength: 25,
      trim: true,
    },
  },

  columns: [
    { key: 'subBranchId', title: 'Sub-Branch ID' },
    { key: 'branchName', title: 'Branch' },
    { key: 'subBranchName', title: 'Sub-Branch Name' },
    { key: 'subBranchDesc', title: 'Description' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' },
    { label: 'Delete', action: 'delete' },
  ],

  pagination: true,
};
