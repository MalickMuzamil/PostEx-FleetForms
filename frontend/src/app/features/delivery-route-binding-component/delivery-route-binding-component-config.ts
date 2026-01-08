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
      options: [], // patched in component
    },
    {
      key: 'branchId',
      label: 'Branch',
      type: 'select',
      required: true,
      options: [], // patched in component
    },
    {
      key: 'subBranchId',
      label: 'Sub Branch',
      type: 'select',
      required: true,
      options: [], // patched in component
    },

    // ✅ NEW FIELD (editable description)
    {
      key: 'correctDescriptionForReports',
      label: 'Correct Description for Reports',
      type: 'select',
      required: true,
      options: [], // ✅ patched in component (from DeliveryRouteDefinitionService.getAll())
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
    placeholder: 'Search BN, Sub-BN, DRD',
    keys: [
      'deliveryRouteDescription',
      'subBranchName',
      'branchName', 
    ],
  },

  columns: [
    { key: 'deliveryRouteId', title: 'Delivery Route ID' },
    { key: 'branchName', title: 'Branch' },
    { key: 'subBranchName', title: 'Sub Branch' },
    { key: 'deliveryRouteDescription', title: 'Delivery Route Description' },
    { key: 'effectiveDate', title: 'Effective Date' },
    { key: 'requiredReportsFlag', title: 'Required Reports (1/0)' },
  ],

  actions: [
    { label: 'Delete', action: 'delete' },
    { label: 'Edit', action: 'edit' },
  ],

  pagination: true,
};
