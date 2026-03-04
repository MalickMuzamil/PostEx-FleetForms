import { TableConfig } from '../../shared/form-model/data-table-model';
import { FormConfig } from '../../shared/form-model/dynamic-form-model';

export const BRANCH_WISE_CALENDER_FORM: FormConfig = {
  title: 'Branch Wise Calender Bulk Import',
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

export const BRANCH_WISE_CALENDER_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search Branch, Date, Desc',
    keys: ['branchDisplay', 'calenderDateDisplay', 'notWorkingDayDesc'],
    rules: { mode: 'alphanumeric', maxLength: 30, trim: true },
  },

  columns: [
    { key: 'branchDisplay', title: 'BRANCH' },            // BranchId or BranchName
    { key: 'calenderDateDisplay', title: 'CALENDER_DATE' },
    { key: 'isNotWorkingDayDisplay', title: 'ISNOTWORKINGDAY' },
    { key: 'notWorkingDayDesc', title: 'NOTWORKINGDAYDESC' },
    { key: 'isArchivedDisplay', title: 'IsArchived' },
    { key: 'createdBy', title: 'CreatedBy' },
    { key: 'createdOnDisplay', title: 'CreatedOn' },
  ],

  pagination: true,
};