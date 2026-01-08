import { FormConfig } from '../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { AppValidators } from '../../core/services/validators';

export const BRANCH_GENERAL_EMP_BINDING_FORM: FormConfig = {
  title: 'Branch and General Employee Binding',

  fields: [
    // ================= EMPLOYEE =================
    {
      key: 'employeeId',
      label: 'Employee',
      type: 'select',
      required: true,
      searchable: true,

      // 👇 dropdown columns (image jaisa)
      optionColumns: [
        { key: 'id', title: 'ID', width: '70px' },
        { key: 'name', title: 'Name' },
        { key: 'cnic', title: 'CNIC' },
      ],
    },

    // ================= BRANCH =================
    {
      key: 'branchId',
      label: 'Branch',
      type: 'select',
      required: true,
      searchable: true,

      // 👇 dropdown columns (image jaisa)
      optionColumns: [
        { key: 'id', title: 'ID', width: '70px' },
        { key: 'name', title: 'Branch Name' },
        { key: 'desc', title: 'Description' },
        { key: 'phone', title: 'Phone' },
        { key: 'address', title: 'Address' },
      ],
    },

    // ================= AUTO FILLED (READONLY) =================
    {
      key: 'branchName',
      label: 'Branch Name',
      type: 'readonly',
      required: false,
      disabled: true,
    },
    {
      key: 'branchDesc',
      label: 'Branch Description',
      type: 'readonly',
      required: false,
      disabled: true,
    },
    {
      key: 'branchShortCode',
      label: 'Branch Short Code',
      type: 'readonly',
      required: false,
      disabled: true,
    },

    // ================= EMAIL =================
    {
      key: 'email',
      label: 'Email Address',
      type: 'text',
      required: true,
      validators: [AppValidators.email(50)],
      // avoid per-keystroke validation for email input
      updateOn: 'blur',
    },

    // ================= EFFECTIVE DATE =================
    {
      key: 'effectiveDate',
      label: 'Effective Date',
      type: 'date',
      required: true,
      validators: [AppValidators.futureDate()],
    },

    // ================= STATUS FLAG =================
    {
      key: 'statusFlag',
      label: 'Status Flag',
      type: 'select',
      required: true,
      options: [
        { label: 'Active (1)', value: 1 },
        { label: 'Inactive (0)', value: 0 },
      ],
      defaultValue: 1,
    },
  ],
};

export const BRANCH_GENERAL_EMP_BINDING_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by branch, employee or email',
    keys: ['branchName', 'employeeName', 'email'],
    rules: {
      mode: 'alphanumeric',
      maxLength: 15,
      trim: true,
    },
  },
  columns: [
    { key: 'branchName', title: 'Branch' },
    { key: 'employeeName', title: 'Employee Name' },
    { key: 'email', title: 'Email' },
    { key: 'effectiveDate', title: 'Effective Date' },
    { key: 'statusText', title: 'Status' },
  ],
  actions: [
    { label: 'Edit', action: 'edit' },
    { label: 'Delete', action: 'delete' },
  ],
  pagination: true,
};
