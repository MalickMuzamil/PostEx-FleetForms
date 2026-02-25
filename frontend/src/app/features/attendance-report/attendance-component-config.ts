import { AppValidators } from '../../core/services/validators';
import { TableConfig } from '../../shared/form-model/data-table-model';
import { FormConfig } from '../../shared/form-model/dynamic-form-model';

export const ATTENDANCE_FORM: FormConfig = {
  title: 'Attendance Bulk Import',
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

export const ATTENDANCE_EDIT_FORM: FormConfig = {
  title: 'Edit Attendance',
  fields: [
    {
      key: 'employeeId',
      label: 'Employee ID',
      type: 'text',
      required: true,
    },
    {
      key: 'attendanceDate',
      label: 'Attendance Date',
      type: 'date',
      required: true,
      // ✅ optional: your validator
      validators: [AppValidators.futureDate()],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        { value: 'Present', label: 'Present' },
        { value: 'Absent', label: 'Absent' },
        { value: 'Late', label: 'Late' },
        { value: 'Leave', label: 'Leave' },
      ],
    },
    {
      key: 'inTime',
      label: 'In Time',
      type: 'text',
      required: false,
    },
    {
      key: 'outTime',
      label: 'Out Time',
      type: 'text',
      required: false,
    },
    {
      key: 'remarks',
      label: 'Remarks',
      type: 'text',
      required: false,
    },
  ],
};

export const ATTENDANCE_TABLE: TableConfig = {
  globalSearch: {
    placeholder: 'Search Employee, Date, Status',
    keys: ['employeeId', 'employeeName', 'attendanceDateDisplay', 'statusDisplay'],
    rules: {
      mode: 'alphanumeric',
      maxLength: 20,
      trim: true,
    },
  },

  columns: [
    { key: 'employeeId', title: 'Employee ID' },
    { key: 'employeeName', title: 'Employee Name' },
    { key: 'attendanceDateDisplay', title: 'Attendance Date' },

    { key: 'division', title: 'Division' },
    { key: 'department', title: 'Department' },
    { key: 'zone', title: 'Zone' },
    { key: 'branch', title: 'Branch' },
    { key: 'inTime', title: 'In Time' },
    { key: 'outTime', title: 'Out Time' },
  ],

  pagination: true,
};