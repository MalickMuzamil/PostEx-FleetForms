import { AppValidators } from '../../core/services/validators';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { FormConfig } from '../../shared/form-model/dynamic-form-model';

export const DELIVERY_ROUTE_BINDING_FORM: FormConfig = {
  title: 'Delivery Route Bulk Import',
  fields: [
    {
      key: 'bulkImport',
      label: 'Bulk Import',
      type: 'file',
      accept: '.csv,.xls,.xlsx',
      required: true,
    },
  ],
};

export const DELIVERY_ROUTE_BINDING_EDIT_FORM: FormConfig = {
  title: 'Edit Delivery Route Binding',
  fields: [
    {
      key: 'deliveryRouteId',
      label: 'Delivery Route',
      type: 'select',
      required: true,
      options: [],
    },
    {
      key: 'branchId',
      label: 'Branch',
      type: 'select',
      required: true,
      options: [],
    },
    {
      key: 'subBranchId',
      label: 'Sub Branch',
      type: 'select',
      required: true,
      options: [],
    },
    {
      key: 'correctDescriptionForReports',
      label: 'Correct Description for Reports',
      type: 'select',
      required: true,
      options: [],
    },
    {
      key: 'effectiveDate',
      label: 'Effective Date',
      type: 'date',
      required: true,
      validators: [AppValidators.futureDate()],
    },
    {
      key: 'requiredReportsFlag',
      label: 'Required Reports',
      type: 'select',
      required: true,
      options: [
        { value: 1, label: 'Active' },
        { value: 0, label: 'Inactive' },
      ],
    },
  ],
};

export const DELIVERY_ROUTE_BINDING_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search Branch, Sub Branch, Route, Desc',
    keys: [
      'deliveryRouteDescription',
      'subBranchName',
      'branchName',
      'deliveryRouteNo',
    ],
    rules: {
      mode: 'alphanumeric',
      maxLength: 20,
      trim: true,
    },
  },

  columns: [
    { key: 'deliveryRouteId', title: 'Delivery Route ID' },

    {
      key: 'deliveryRouteNo',
      title: 'Delivery Route',
      filter: {
        type: 'select',
        placeholder: 'Delivery Route',
        options: [],
      },
    },
    {
      key: 'branchName',
      title: 'Branch',
      filter: {
        type: 'select',
        placeholder: 'Branch',
        options: [],
      },
    },
    {
      key: 'subBranchName',
      title: 'Sub Branch',
      filter: {
        type: 'select',
        placeholder: 'Sub Branch',
        options: [],
      },
    },
    { key: 'deliveryRouteDescription', title: 'Delivery Route Description' },
    {
      key: 'effectiveDateDisplay',
      title: 'Effective Date',
      filter: {
        type: 'date',
        placeholder: 'Effective Date',
      },
    },
    {
      key: 'requiredReportsDisplay',
      title: 'Required Reports',
      filter: {
        type: 'select',
        placeholder: 'Required in Reports',
        options: [
          { label: 'Active', value: 'Active' },
          { label: 'Inactive', value: 'Inactive' },
        ],
      },
    },
  ],

  actions: [{ label: 'Edit', action: 'edit' }],
  pagination: true,
};