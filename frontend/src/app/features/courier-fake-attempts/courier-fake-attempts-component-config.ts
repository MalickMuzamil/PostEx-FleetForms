import { AppValidators } from '../../core/services/validators';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { FormConfig } from '../../shared/form-model/dynamic-form-model';

export const COURIER_FAKE_ATTEMPTS_FORM: FormConfig = {
  title: 'Courier Fake Attempts Bulk Import',
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

export const COURIER_FAKE_ATTEMPTS_EDIT_FORM: FormConfig = {
  title: 'Edit Fake Attempt',
  fields: [
    { key: 'cnNo', label: 'CNNo', type: 'text', required: true },
    { key: 'branchName', label: 'BranchName', type: 'text', required: true },
    { key: 'attempts', label: 'Attempts', type: 'text', required: true },
    { key: 'courierId', label: 'CourierID', type: 'text', required: true },
    { key: 'rider', label: 'Rider', type: 'text', required: true },
    { key: 'fakeAttempts', label: 'Fake_Attempts', type: 'text', required: true },
    {
      key: 'date',
      label: 'Date',
      type: 'date',
      required: true,
      validators: [AppValidators.futureDate()],
    },
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

export const COURIER_FAKE_ATTEMPTS_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search CNNo, Rider, Branch',
    keys: ['cnNo', 'rider', 'branchName', 'courierId', 'dateDisplay'],
    rules: {
      mode: 'alphanumeric',
      maxLength: 20,
      trim: true,
    },
  },

  columns: [
    { key: 'cnNo', title: 'CNNo' },

    {
      key: 'branchName',
      title: 'BranchName',
      filter: {
        type: 'select',
        placeholder: 'BranchName',
        options: [],
      },
    },

    { key: 'attempts', title: 'Attempts' },
    { key: 'courierId', title: 'CourierID' },

    {
      key: 'rider',
      title: 'Rider',
      filter: {
        type: 'select',
        placeholder: 'Rider',
        options: [],
      },
    },

    { key: 'fakeAttempts', title: 'Fake_Attempts' },

    {
      key: 'dateDisplay',
      title: 'Date',
      filter: {
        type: 'date',
        placeholder: 'Date',
      },
    },

    { key: 'isArchivedDisplay', title: 'IsArchived' },
    { key: 'createdBy', title: 'CreatedBy' },
    { key: 'createdOnDisplay', title: 'CreatedOn' },
  ],

  pagination: true,
};