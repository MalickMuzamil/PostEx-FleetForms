import { FormConfig } from '../../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../../shared/form-model/data-table-model';
import { AppValidators } from '../../../core/services/validators';

/* ============================================================
   FORM CONFIG
============================================================ */

export const OPS_CNC_L3_L4_MAPPING_FORM: FormConfig = {
  title: 'CnC L3 - CnC L4 Mapping',

  fields: [

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

    // ================= CNC L4 =================
    {
      key: 'cncL4Id',
      label: 'CnC L4',
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

export const OPS_CNC_L3_L4_MAPPING_TABLE: TableConfig = {

  globalSearch: {
    placeholder: 'Search by CNC L3 / CNC L4',
    keys: [
      'cncL3Id',
      'cncL3Description',
      'cncL4Id',
      'cncL4Description'
    ],
    rules: { mode: 'alphanumeric', maxLength: 30, trim: true },
  },

  columns: [
    { key: 'id', title: 'ID' },
    { key: 'cncL3Id', title: 'CnC L3' },
    { key: 'cncL3Description', title: 'CnC L3 Description' },
    { key: 'cncL4Id', title: 'CnC L4' },
    { key: 'cncL4Description', title: 'CnC L4 Description' },
    { key: 'effectiveDate', title: 'Effective Date' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' }
  ],

  pagination: true,

};
