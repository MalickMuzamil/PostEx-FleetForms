import { FormConfig } from '../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { AppValidators } from '../../core/services/validators';

export const BRANCH_COORDINATOR_ASSIGNMENT_FORM: FormConfig = {
  title: 'Branch and Branch Coordinator Binding',
  fields: [
    {
      key: 'employeeId',
      label: 'Employee',
      type: 'select',
      required: true,
      searchable: true,
      optionColumns: [
        { key: 'id', title: 'ID', width: '70px' },
        { key: 'name', title: 'Name' },
        { key: 'department', title: 'Department' },
        { key: 'designation', title: 'Designation' },
      ],
    },
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
    {
      key: 'email',
      label: 'Coordinator Email Address',
      type: 'text',
      required: true,
      validators: [AppValidators.email(50)],
      updateOn: 'change',
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
    {
      key: 'branchName',
      title: 'Branch',
      filter: {
        type: 'select',
        placeholder: 'Branch',
        options: [],
      },
    },
    { key: 'employeeName', title: 'Employee Name' },
    { key: 'email', title: 'Email' },
    {
      key: 'effectiveDateDisplay',
      title: 'Effective Date',
      filter: {
        type: 'date',
        placeholder: 'Effective Date',
      },
    },
  ],

  actions: [{ label: 'Edit', action: 'edit' }],
  pagination: true,
};