import { FormConfig } from '../../shared/form-model/dynamic-form-model';
import { TableConfig } from '../../shared/form-model/data-table-model';

export const DELIVERY_ROUTE_DEFINITION_FORM: FormConfig = {
  title: 'Delivery Route Definition',
  fields: [
    {
      key: 'routeId',
      label: 'Delivery Route ID',
      type: 'readonly',
      disabled: true,
    },
    {
      key: 'routeDescription',
      label: 'Delivery Route Description',
      type: 'text',
      required: true,
    },
  ],
};

export const DELIVERY_ROUTE_DEFINITION_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search by id or description',
    keys: ['Id', 'CorrectionDescriptionforReports'],
    rules: {
      mode: 'alphanumeric',
      maxLength: 20,
      trim: true,
    },
  },

  columns: [
    { key: 'Id', title: 'ID' },
    {
      key: 'CorrectionDescriptionforReports',
      title: 'Delivery Route Description',
    },
  ],

  // actions: [{ label: 'Delete', action: 'delete' }],

  pagination: true,
};
