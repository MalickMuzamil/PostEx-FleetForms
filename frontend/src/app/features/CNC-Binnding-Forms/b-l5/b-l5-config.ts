import { FormConfig } from '../../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../../shared/form-model/data-table-model';
import { AppValidators } from '../../../core/services/validators';

/* ============================================================
   FORM CONFIG
============================================================ */

export const OPS_CNC_L4_L5_MAPPING_FORM: FormConfig = {
  title: 'CnC L4 - CnC L5 Mapping',

  fields: [

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

export const OPS_CNC_L4_L5_MAPPING_TABLE: TableConfig = {

  globalSearch: {
    placeholder: 'Search by CNC L4 / CNC L5',
    keys: [
      'cncL4Id',
      'cncL4Description',
      'cncL5Id',
      'cncL5Description'
    ],
    rules: { mode: 'alphanumeric', maxLength: 30, trim: true },
  },

  columns: [
    { key: 'id', title: 'ID' },
    { key: 'cncL4Name', title: 'CnC L4' },
    { key: 'cncL4Description', title: 'CnC L4 Description' },
    { key: 'cncL5Name', title: 'CnC L5' },
    { key: 'cncL5Description', title: 'CnC L5 Description' },
    { key: 'effectiveDate', title: 'Effective Date' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' }
  ],

  pagination: true,

};
