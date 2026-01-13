import { FormConfig } from '../../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../../shared/form-model/data-table-model';
import { AppValidators } from '../../../core/services/validators';

export const OPS_CNC_L3_DEFINITION_FORM: FormConfig = {
  title: 'CnC Definition - L3',
  fields: [
    {
      key: 'role',
      label: 'Role',
      type: 'text',
      disabled: true,
    },
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      mask: 'SHORT_CODE_3_2',
      validators: [
        AppValidators.nameShortCode3Dash2Friendly(),
        AppValidators.maxLen(6),
      ],
      updateOn: 'change',
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      required: true,
      validators: [AppValidators.maxLen(50)],
    },
    {
      key: 'enteredOn',
      label: 'Entered On',
      type: 'readonly',
      disabled: true,
    },
    {
      key: 'enteredBy',
      label: 'Entered By',
      type: 'readonly',
      disabled: true,
    },
    {
      key: 'editedOn',
      label: 'Edited On',
      type: 'readonly',
      disabled: true,
    },
    {
      key: 'editedBy',
      label: 'Edited By',
      type: 'readonly',
      disabled: true,
    },
  ],
};

export const OPS_CNC_L3_DEFINITION_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by name/description',
    keys: ['name', 'description', 'role', 'enteredBy', 'editedBy'],
    rules: { mode: 'alphanumeric', maxLength: 30, trim: true },
  },
  columns: [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Name' },
    { key: 'description', title: 'Description' },
    { key: 'role', title: 'Role' },
    { key: 'enteredOn', title: 'Entered On' },
    { key: 'enteredBy', title: 'Entered By' },
    { key: 'editedOn', title: 'Edited On' },
    { key: 'editedBy', title: 'Edited By' },
  ],
  actions: [
    { label: 'Edit', action: 'edit' },
    { label: 'Delete', action: 'delete' },
  ],
  pagination: true,
};
