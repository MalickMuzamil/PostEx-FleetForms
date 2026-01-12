import { FormConfig } from '../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { AppValidators } from '../../core/services/validators';

export const CNC_LEVEL_FORM: FormConfig = {
  title: 'CNC Level Definition',

  fields: [
    {
      key: 'cncLevelId',
      label: 'CNC Level ID',
      type: 'readonly',
      disabled: true,
    },

    {
      key: 'levelType',
      label: 'Type',
      type: 'select',
      required: true,
      options: [
        { label: 'Area', value: 'AREA' },
        { label: 'Sub-Area', value: 'SUB_AREA' },
        { label: 'Zone', value: 'ZONE' },
        { label: 'Sub-Zone', value: 'SUB_ZONE' },
        { label: 'Region', value: 'REGION' },
        { label: 'Other (Custom)', value: 'OTHER' },
      ],
      defaultValue: 'AREA',
    },

    {
      key: 'areaId',
      label: 'Area',
      type: 'select',
      required: false,
      searchable: true,
      options: [],
      optionColumns: [
        { key: 'id', title: 'ID', width: '80px' },
        { key: 'name', title: 'Area Name' },
      ],
      // DynamicForm supports enabledWhen/disabledWhen
      enabledWhen: ['levelType'], // we will toggle required in component
    },

    {
      key: 'zoneId',
      label: 'Zone',
      type: 'select',
      required: false,
      searchable: true,
      options: [],
      optionColumns: [
        { key: 'id', title: 'ID', width: '80px' },
        { key: 'name', title: 'Zone Definition' },
      ],
      enabledWhen: ['levelType'],
    },

    {
      key: 'regionId',
      label: 'Region',
      type: 'select',
      required: false,
      searchable: true,
      options: [],
      optionColumns: [
        { key: 'id', title: 'ID', width: '80px' },
        { key: 'name', title: 'Region Definition' },
      ],
      enabledWhen: ['levelType'],
    },

    // ✅ UNIFIED INPUT FIELD (single)
    {
      key: 'term',
      label: 'Definition / Name',
      type: 'text',
      required: true,
      validators: [AppValidators.alphaSpace(50)],
      updateOn: 'blur',
    },
  ],
};

export const CNC_LEVEL_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by type, term, parent',
    keys: [
      'cncLevelId',
      'levelType',
      'term',
      'areaName',
      'zoneName',
      'regionName',
    ],
  },

  columns: [
    { key: 'cncLevelId', title: 'CNC Level ID' },
    { key: 'levelTypeText', title: 'Type' },
    { key: 'term', title: 'Name / Definition' },
    { key: 'areaName', title: 'Area' },
    { key: 'zoneName', title: 'Zone' },
    { key: 'regionName', title: 'Region' },
  ],

  actions: [
    { label: 'Edit', action: 'edit' },
    { label: 'Delete', action: 'delete' },
  ],

  pagination: true,
};
