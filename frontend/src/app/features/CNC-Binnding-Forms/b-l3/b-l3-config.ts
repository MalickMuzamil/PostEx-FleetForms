import { FormConfig } from '../../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../../shared/form-model/data-table-model';
import { AppValidators } from '../../../core/services/validators';

/* ============================================================
   FORM CONFIG
============================================================ */

export const OPS_CNC_L2_L3_MAPPING_FORM: FormConfig = {
  title: 'CnC L2 - CnC L3 Mapping',

  fields: [

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

    // ================= CNC L3 =================
    {
      key: 'cncL3Id',
      label: 'CnC L3',
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

export const OPS_CNC_L2_L3_MAPPING_TABLE: TableConfig = {

  globalSearch: {
    placeholder: 'Search by CNC L2 / CNC L3',
    keys: [
      'cncL2Id',
      'cncL2Description',
      'cncL3Id',
      'cncL3Description'
    ],
    rules: { mode: 'alphanumeric', maxLength: 30, trim: true },
  },

  columns: [
    { key: 'id', title: 'ID' },
    { key: 'cncL2Id', title: 'CnC L2' },
    { key: 'cncL2Description', title: 'CnC L2 Description' },
    { key: 'cncL3Id', title: 'CnC L3' },
    { key: 'cncL3Description', title: 'CnC L3 Description' },
    { key: 'effectiveDate', title: 'Effective Date' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' }
  ],

  pagination: true,

};
