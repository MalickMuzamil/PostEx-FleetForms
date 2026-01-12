import { FormConfig } from '../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { AppValidators } from '../../core/services/validators';

export const SUB_BRANCH_ASSIGNMENT_DEFINITION_FORM: FormConfig = {
  title: 'Sub-Branch Assignment Definition',

  fields: [
    {
      key: 'subBranchId',
      label: 'Sub-Branch',
      type: 'select',
      required: true,
      searchable: true,
      options: [],

      optionColumns: [
        { key: 'id', title: 'ID', width: '80px' },
        { key: 'name', title: 'Sub-Branch Name' },
        { key: 'branchId', title: 'Branch ID', width: '90px' },
        { key: 'branchName', title: 'Branch Name' },
      ],
    },

    {
      key: 'subBranchName',
      label: 'Sub-Branch Name',
      type: 'readonly',
      disabled: true,
    },
    { key: 'branchId', label: 'Branch ID', type: 'readonly', disabled: true },
    {
      key: 'branchName',
      label: 'Branch Name',
      type: 'readonly',
      disabled: true,
    },

    {
      key: 'employeeId',
      label: 'Employee (In-Charge)',
      type: 'select',
      required: true,
      searchable: true,
      options: [],

      optionColumns: [
        { key: 'id', title: 'ID', width: '80px' },
        { key: 'name', title: 'Name' },
        { key: 'departmentName', title: 'Department' },
        { key: 'designationName', title: 'Designation' },
      ],
    },

    {
      key: 'email',
      label: 'Email Address',
      type: 'text',
      required: true,
      validators: [AppValidators.email(50)],
      updateOn: 'blur',
    },

    {
      key: 'effectiveDate',
      label: 'Effective Date',
      type: 'date',
      required: true,
      validators: [AppValidators.futureDate()],
    },

    // {
    //   key: 'statusFlag',
    //   label: 'Status Flag',
    //   type: 'select',
    //   required: true,
    //   options: [
    //     { label: 'Active (1)', value: 1 },
    //     { label: 'Inactive (0)', value: 0 },
    //   ],
    //   defaultValue: 1,
    // },
  ],
};

export const SUB_BRANCH_ASSIGNMENT_DEFINITION_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by employee, sub-branch or email',
    keys: [
      'employeeName',
      'employeeId',
      'subBranchName',
      'subBranchId',
      'email',
    ],
  },

  columns: [
    { key: 'subBranchId', title: 'Sub-Branch ID' },
    { key: 'subBranchName', title: 'Sub-Branch' },
    { key: 'branchName', title: 'Branch' },
    { key: 'employeeName', title: 'Employee' },
    { key: 'email', title: 'Email' },
    { key: 'effectiveDate', title: 'Effective Date' },
    // { key: 'statusText', title: 'Status' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' },
    { label: 'Delete', action: 'delete' },
  ],

  pagination: true,
};
