import { FormConfig } from '../../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../../shared/form-model/data-table-model';
import { AppValidators } from '../../../core/services/validators';

/* ============================================================
   FORM CONFIG
============================================================ */

export const OPS_CNC_L1_BRANCH_MAPPING_FORM: FormConfig = {
  title: 'CnC L1 - Branch Mapping',

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
        { key: 'desc', title: 'Description' }
      ],
    },

    // ================= CNC L1 =================
    {
      key: 'cncL1Id',
      label: 'CnC L1',
      type: 'select',
      required: true,
      searchable: true,

      optionColumns: [
        { key: 'id', title: 'ID', width: '70px' },
        { key: 'name', title: 'Code' },
        { key: 'desc', title: 'Description' }
      ],
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



/* ============================================================
   TABLE CONFIG
============================================================ */

export const OPS_CNC_L1_BRANCH_MAPPING_TABLE: TableConfig = {

  globalSearch: {
    placeholder: 'Search by branch / CNC L1',
    keys: [
      'branchId',
      'branchDescription',
      'cncL1Id',
      'cncL1Description',
      'enteredBy',
      'editedBy'
    ],
    rules: { mode: 'alphanumeric', maxLength: 30, trim: true },
  },

  columns: [
    { key: 'id', title: 'ID' },
    { key: 'branchName', title: 'Branch' },
    { key: 'branchDescription', title: 'Branch Description' },
    { key: 'cncL1Name', title: 'CnC L1' },
    { key: 'cncL1Description', title: 'CnC L1 Description' },
    { key: 'effectiveDate', title: 'Effective Date' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' },
    // { label: 'Delete', action: 'delete' }
  ],

  pagination: true,

};
