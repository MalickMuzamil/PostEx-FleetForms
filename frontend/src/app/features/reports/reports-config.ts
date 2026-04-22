import { TableConfig } from '../../shared/form-model/data-table-model';

export const REPORTS_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by Email, Name, Role',
    keys: ['email', 'name', 'role'],
    rules: {
      mode: 'alphanumeric',
      maxLength: 50,
      trim: true,
    },
  },

  columns: [
    { key: 'name', title: 'Name' },
    { key: 'email', title: 'Email' },
    { key: 'phone', title: 'Phone' },
    { key: 'role', title: 'Role' },
    { key: 'verificationStatus', title: 'Status' },
    { key: 'branchScenario', title: 'Branch Scenario' },
    { key: 'branchCount', title: 'Branch Count' },
    { key: 'totalBranches', title: 'Total Branches' },
    { key: 'isAllBranches', title: 'All Branches' },
  ],
};