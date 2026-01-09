import { FormConfig } from '../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { AppValidators } from '../../core/services/validators';

export const BRANCH_COORDINATOR_ASSIGNMENT_FORM: FormConfig = {
  title: 'Branch and Branch Coordinator Binding',

  fields: [
    // ================= EMPLOYEE =================
    {
      key: 'employeeId',
      label: 'Employee',
      type: 'select',
      required: true,
      searchable: true,

      // 👇 dropdown columns
      optionColumns: [
        { key: 'id', title: 'ID', width: '70px' },
        { key: 'name', title: 'Name' },
        { key: 'department', title: 'Department' },
        { key: 'designation', title: 'Designation' },
      ],
    },

    // ================= BRANCH =================
    {
      key: 'branchId',
      label: 'Branch',
      type: 'select',
      required: true,
      searchable: true,

      // 👇 dropdown columns
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
      disabled: true,
    },
    {
      key: 'branchDesc',
      label: 'Branch Description',
      type: 'readonly',
      disabled: true,
    },
    {
      key: 'branchEmail',
      label: 'Branch Email',
      type: 'readonly',
      disabled: true,
    },
    {
      key: 'branchPhone',
      label: 'Branch Phone',
      type: 'readonly',
      disabled: true,
    },
    {
      key: 'branchAddress',
      label: 'Branch Address',
      type: 'readonly',
      disabled: true,
    },

    // ================= COORDINATOR EMAIL =================
    {
      key: 'email',
      label: 'Coordinator Email Address',
      type: 'text',
      required: true,
      validators: [AppValidators.email(50)],
      // avoid per-keystroke validation for email input: update on blur
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
  ],
};

// ================= TABLE CONFIG =================

export const BRANCH_COORDINATOR_ASSIGNMENT_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search in table...',
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
    { key: 'effectiveDateDisplay', title: 'Effective Date' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' },
    { label: 'Delete', action: 'delete' },
  ],

  pagination: true,
};
