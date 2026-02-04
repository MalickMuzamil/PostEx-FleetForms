import { FormConfig } from '../../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../../shared/form-model/data-table-model';
import { AppValidators } from '../../../core/services/validators';

/* ============================================================
   FORM CONFIG
============================================================ */

export const OPS_CNC_L1_L2_MAPPING_FORM: FormConfig = {
  title: 'CnC L1 - CnC L2 Mapping',

  fields: [

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

    // ================= CNC L2 =================
    {
      key: 'cncL2Id',
      label: 'CnC L2',
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

export const OPS_CNC_L1_L2_MAPPING_TABLE: TableConfig = {

  globalSearch: {
    placeholder: 'Search by CNC L1 / CNC L2',
    keys: [
      'cncL1Id',
      'cncL1Description',
      'cncL2Id',
      'cncL2Description'
    ],
    rules: { mode: 'alphanumeric', maxLength: 30, trim: true },
  },

  columns: [
    { key: 'id', title: 'ID' },
    { key: 'cncL1Id', title: 'CnC L1' },
    { key: 'cncL1Description', title: 'CnC L1 Description' },
    { key: 'cncL2Id', title: 'CnC L2' },
    { key: 'cncL2Description', title: 'CnC L2 Description' },
    { key: 'effectiveDate', title: 'Effective Date' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' }
  ],

  pagination: true,

};
