import { TableConfig } from '../../shared/form-model/data-table-model';

export const REPORTS_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by Name, Email, Role',
    keys: ['name', 'email', 'role'],
    rules: {
      mode: 'alphanumeric',
      maxLength: 50,
      trim: true,
    },
  },

  columns: [
    { key: 'Login_Id', title: 'Login ID' },
    { key: 'name', title: 'Name' },
    { key: 'email', title: 'Email' },
    { key: 'role', title: 'Role' },
    { key: 'u_BranchID', title: 'Branch ID' },
    { key: 'u_BranchName', title: 'Branch Name' },
    { key: 'verificationStatus', title: 'Status' },
    { key: 'branchScenario', title: 'Access Type' },
    { key: 'branchCount', title: 'Accessible Branches' },
    { key: 'isAllBranches', title: 'All Branches Access' },
  ],
};