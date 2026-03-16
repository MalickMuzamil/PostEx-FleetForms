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
      type: 'text',
      required: true,
      mask: 'AAA_AAA_AAA',
      maskPrefixKey: 'branchId',
      validators: [AppValidators.maxLen(20)],
      updateOn: 'change',
    },
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
    {
      key: 'branchName',
      title: 'Branch',
      filter: {
        type: 'select',
        placeholder: 'Branch',
        options: [],
      },
    },
    {
      key: 'subBranchName',
      title: 'Sub-Branch Name',
      filter: {
        type: 'select',
        placeholder: 'Sub-Branch Name',
        options: [],
      },
    },
    { key: 'subBranchDesc', title: 'Description' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' },
    { label: 'Delete', action: 'delete' },
  ],

  pagination: true,
};