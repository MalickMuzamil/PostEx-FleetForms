import { FormConfig } from '../../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../../shared/form-model/data-table-model';
import { AppValidators } from '../../../core/services/validators';

/* ============================================================
   FORM CONFIG
============================================================ */

export const OPS_CNC_L5_L6_MAPPING_FORM: FormConfig = {
  title: 'CnC L5 - CnC L6 Mapping',

  fields: [

    // ================= CNC L5 =================
    {
      key: 'cncL5Id',
      label: 'CnC L5',
      type: 'select',
      required: true,
      searchable: true,
      optionColumns: [
        { key: 'id', title: 'ID', width: '70px' },
        { key: 'name', title: 'Code' },
        { key: 'desc', title: 'Description' }
      ],
    },

    // ================= CNC L6 =================
    {
      key: 'cncL6Id',
      label: 'CnC L6',
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

export const OPS_CNC_L5_L6_MAPPING_TABLE: TableConfig = {

  globalSearch: {
    placeholder: 'Search by CNC L5 / CNC L6',
    keys: [
      'cncL5Id',
      'cncL5Description',
      'cncL6Id',
      'cncL6Description'
    ],
    rules: { mode: 'alphanumeric', maxLength: 30, trim: true },
  },

  columns: [
    { key: 'id', title: 'ID' },
    { key: 'cncL5Id', title: 'CnC L5' },
    { key: 'cncL5Description', title: 'CnC L5 Description' },
    { key: 'cncL6Id', title: 'CnC L6' },
    { key: 'cncL6Description', title: 'CnC L6 Description' },
    { key: 'effectiveDate', title: 'Effective Date' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' }
  ],

  pagination: true,

};
