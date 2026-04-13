import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { AuthService } from '../../core/services/auth-service';

import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

import {
  ATTENDANCE_FORM,
  ATTENDANCE_EDIT_FORM,
  ATTENDANCE_TABLE,
} from './attendance-component-config';

import { AttendanceService } from '../../core/services/attendance-service';

@Component({
  selector: 'app-attendance-report',
  imports: [Table, Modal, NzModalModule],
  templateUrl: './attendance-report.html',
  styleUrl: './attendance-report.css',
})
export class AttendanceReport implements OnInit {
  // ===== CONFIGS =====
  bulkFormConfig = { ...ATTENDANCE_FORM };
  editFormConfig = { ...ATTENDANCE_EDIT_FORM };
  formConfig: any = { ...ATTENDANCE_FORM };

  tableConfig = structuredClone(ATTENDANCE_TABLE);

  // ===== STATE =====
  showModal = false;
  data: any = {};
  tableData: any[] = [];

  // ===== EDIT MODE =====
  isEditMode = false;
  editingRow: any = null;

  private suppressChanges = false;

  private readonly REQUIRED_COLUMNS = ['EMP_ID', 'DATE', 'EMP_NAME', 'DEPARTMENT', 'DIVISION', 'ZONE', 'BRANCH', 'SHIFT', 'SHIFT_TIME', 'IN_TIME', 'OUT_TIME', 'TIMETRAX_REMARKS'];

  private readonly RECOMMENDED_COLUMNS = ['EMP_NAME', 'SHIFT', 'SHIFT_TIME', 'TIMETRAX_REMARKS'];

  private readonly VALID_REMARKS = ['Present', 'present', 'Absent', 'absent', 'Leave', 'leave', 'Holiday', 'holiday', 'Off Day', 'OFF DAY'];

  constructor(
    private attendanceService: AttendanceService,
    private router: Router,
    private notification: NzNotificationService,
    private modal: NzModalService,
    private auth: AuthService
  ) { }

  ngOnInit(): void {
    if (!this.auth.hasRole('HR') && !this.auth.hasRole('ADMIN')) {
      this.router.navigate(['/']);
      return;
    }

    this.loadTable();
  }

  private normalizeSelectValue(v: any): any {
    return v?.value ?? v;
  }

  // ================= TABLE =================
  loadTable() {
    this.attendanceService.getAll().subscribe({
      next: (res: any) => {
        const rows = res?.data ?? res ?? [];

        const mappedRows = (rows || []).map((r: any) => {
          const empId =
            r.EMP_ID ?? r.EmployeeId ?? r.EmployeeID ?? r.employeeId ?? '';

          const empName =
            r.EMP_NAME ?? r.EmployeeName ?? r.employeeName ?? 'NA';

          const dateStr =
            this.isoDateOnly(r.DATE ?? r.AttendanceDate ?? r.attendanceDate);

          const inTimeStr =
            this.isoTimeHHmm(r.IN_TIME ?? r.InTime ?? r.inTime);

          const outTimeStr =
            this.isoTimeHHmm(r.OUT_TIME ?? r.OutTime ?? r.outTime);

          const remarks =
            r.TIMETRAX_REMARKS ?? r.Remarks ?? r.remarks ?? '';

          const isArchived = r.IsArchived ?? r.isArchived;
          const status =
            typeof isArchived === 'boolean'
              ? (isArchived ? 'Inactive' : 'Active')
              : (String(r.Status ?? r.status ?? '').trim() || '');

          return {
            id: r.ID ?? r.Id ?? r.SR_NO,

            employeeId: String(empId ?? ''),
            employeeName: String(empName ?? 'NA') || 'NA',

            attendanceDate: dateStr ? new Date(dateStr) : null,
            attendanceDateDisplay: dateStr || '',

            status: status,
            statusDisplay: status || '-',

            inTime: inTimeStr || '-',
            outTime: outTimeStr || '-',
            remarks: String(remarks ?? ''),

            division: String(r.DIVISION ?? r.Division ?? 'NA') || 'NA',
            department: String(r.DEPARTMENT ?? r.Department ?? 'NA') || 'NA',
            zone: String(r.ZONE ?? r.Zone ?? 'NA') || 'NA',
            branch: String(r.BRANCH ?? r.Branch ?? 'NA') || 'NA',
          };
        });

        this.tableData = mappedRows;

        const employeeValues = mappedRows
          .map((x: any) => x.employeeName)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== 'NA');

        const divisionValues = mappedRows
          .map((x: any) => x.division)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== 'NA');

        const departmentValues = mappedRows
          .map((x: any) => x.department)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== 'NA');

        const zoneValues = mappedRows
          .map((x: any) => x.zone)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== 'NA');

        const branchValues = mappedRows
          .map((x: any) => x.branch)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== 'NA');

        const employeeOptions = [...new Set<string>(employeeValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        const divisionOptions = [...new Set<string>(divisionValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        const departmentOptions = [...new Set<string>(departmentValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        const zoneOptions = [...new Set<string>(zoneValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        const branchOptions = [...new Set<string>(branchValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        this.tableConfig = {
          ...this.tableConfig,
          columns: this.tableConfig.columns.map((col: any) => {
            if (col.key === 'employeeName') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'Employee Name',
                  options: employeeOptions,
                },
              };
            }

            if (col.key === 'division') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'Division',
                  options: divisionOptions,
                },
              };
            }

            if (col.key === 'department') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'Department',
                  options: departmentOptions,
                },
              };
            }

            if (col.key === 'zone') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'Zone',
                  options: zoneOptions,
                },
              };
            }

            if (col.key === 'branch') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'Branch',
                  options: branchOptions,
                },
              };
            }

            return col;
          }),
        };
      },
      error: () =>
        this.notification.error('Error', 'Failed to load attendance list'),
    });
  }

  // ================= MODAL =================
  openAddForm() {
    this.isEditMode = false;
    this.editingRow = null;

    this.formConfig = { ...this.bulkFormConfig };
    this.data = {};
    this.showModal = true;
  }

  openEditForm(row: any) {
    this.isEditMode = true;
    this.editingRow = row;

    this.formConfig = { ...this.editFormConfig };
    this.data = {
      employeeId: row.employeeId,
      attendanceDate: this.asLocalDate(row.attendanceDate ?? row.AttendanceDate),
      status: row.status,
      inTime: row.inTime,
      outTime: row.outTime,
      remarks: row.remarks,
    };

    this.showModal = true;
    this.data = { ...this.data };
  }

  closeModal() {
    this.showModal = false;
  }

  // ================= FORM CHANGE =================
  async onFormChange(evt: { key: string; value: any; formValue: any }) {
    if (this.suppressChanges) return;

    // -------- BULK IMPORT FLOW --------
    if (!this.isEditMode && evt.key === 'bulkImport' && evt.value) {
      const file: File = evt.value;
      const isValid = await this.validateBulkFile(file);

      if (!isValid) return;

      this.showModal = false;
      this.router.navigate(['/attendance-bulk-preview'], { state: { file } });
      return;
    }

    if (!this.isEditMode) return;

    const key = evt?.key;
    const v = this.normalizeSelectValue(evt?.value);

    if (key === 'attendanceDate') {
      this.data.attendanceDate = this.asLocalDate(v);
      return;
    }

    if (key) (this.data as any)[key] = v;

    if (key === 'submit') {
      await this.saveEdit(this.data);
    }
  }

  async saveEdit(formValue: any) {
    if (!this.editingRow?.id) return;
    this.notification.info('Info', 'Backend update API baad me connect hoga.');
    this.showModal = false;
  }

  delete(row: any) {
    this.modal.confirm({
      nzTitle: 'Delete Confirmation',
      nzContent: 'Are you sure you want to delete this attendance?',
      nzOkText: 'Yes, Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => {
        this.notification.info('Info', 'Backend delete API baad me connect hoga.');
      },
    });
  }

  // ================= FILE VALIDATION =================

  private normalizeHeader(s: any): string {
    return String(s ?? '')
      .trim()
      .toUpperCase()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  private showInvalidFile(message: string) {
    this.notification.error('Invalid File', message, { nzDuration: 5000 });
  }

  private validateBulkFile(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const ext = file.name.split('.').pop()?.toLowerCase();

      const allowed = ['csv', 'xls', 'xlsx'];
      if (!ext || !allowed.includes(ext)) {
        this.showInvalidFile('Only CSV / XLS / XLSX files are allowed.');
        resolve(false);
        return;
      }

      // ✅ CSV
      if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res: any) => {
            const headers: string[] = res?.meta?.fields ?? [];

            // empty header check
            if (!headers.length) {
              this.showInvalidFile('CSV file has no header row. Please upload a valid attendance file.');
              resolve(false);
              return;
            }

            resolve(this.validateHeadersAndWarn(headers));
          },
          error: () => {
            this.showInvalidFile('Unable to read CSV file. Please try again.');
            resolve(false);
          },
        });
        return;
      }

      // ✅ XLS/XLSX
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const sheetName = wb.SheetNames?.[0];

          if (!sheetName) {
            this.showInvalidFile('Excel file has no sheets.');
            resolve(false);
            return;
          }

          const sheet = wb.Sheets[sheetName];

          // ✅ get header row directly
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

          if (!rows?.length || !rows[0]?.length) {
            this.showInvalidFile('Excel file is empty or header row is missing.');
            resolve(false);
            return;
          }

          const headers = (rows[0] as any[]).map((h) => String(h ?? '').trim()).filter(Boolean);

          if (!headers.length) {
            this.showInvalidFile('Excel header row is empty. Please upload a valid attendance file.');
            resolve(false);
            return;
          }

          resolve(this.validateHeadersAndWarn(headers));
        } catch {
          this.showInvalidFile('Unable to read Excel file. Please upload a valid attendance file.');
          resolve(false);
        }
      };

      reader.onerror = () => {
        this.showInvalidFile('Unable to read file. Please try again.');
        resolve(false);
      };

      reader.readAsBinaryString(file);
    });
  }

  private validateHeadersAndWarn(headers: string[]): boolean {
    const normalized = headers.map((h) => this.normalizeHeader(h));
    const set = new Set(normalized);

    // ✅ duplicate header warning (not invalid)
    const dupes = normalized.filter((h, i) => normalized.indexOf(h) !== i);
    if (dupes.length) {
      this.notification.warning(
        'Warning',
        `Duplicate columns found in file: ${Array.from(new Set(dupes)).join(', ')}`
      );
    }

    const required = this.REQUIRED_COLUMNS.map((c) => this.normalizeHeader(c));
    const missing = required.filter((c) => !set.has(c));

    if (missing.length) {
      this.showInvalidFile(
        `Your file is not valid because these required columns are missing: ${missing.join(
          ', '
        )}.`
      );
      return false;
    }

    // ✅ recommended (warning only)
    const recommended = this.RECOMMENDED_COLUMNS.map((c) => this.normalizeHeader(c));
    const missingRecommended = recommended.filter((c) => !set.has(c));

    if (missingRecommended.length) {
      this.notification.warning(
        'Warning',
        `Recommended columns missing: ${missingRecommended.join(', ')}`
      );
    }

    return true;
  }

  private asLocalDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;

    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const y = +v.slice(0, 4);
      const m = +v.slice(5, 7);
      const d = +v.slice(8, 10);
      return new Date(y, m - 1, d);
    }

    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
  }

  private isoDateOnly(v: any): string {
    const s = String(v ?? '').trim();
    // "2026-02-23T00:00:00.000Z" -> "2026-02-23"
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return '';
  }

  private isoTimeHHmm(v: any): string {
    const s = String(v ?? '').trim();
    // "1900-01-01T09:03:00.000Z" -> "09:03"
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(11, 16);
    // already "09:03"
    if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, '0');
    return '';
  }
}