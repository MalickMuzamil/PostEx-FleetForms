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
  COURIER_FAKE_ATTEMPTS_FORM,
  COURIER_FAKE_ATTEMPTS_EDIT_FORM,
  COURIER_FAKE_ATTEMPTS_TABLE,
} from './courier-fake-attempts-component-config';

import { CourierFakeAttemptsService } from '../../core/services/courier-fake-attempts-service';

@Component({
  selector: 'app-courier-fake-attempts',
  imports: [Table, Modal, NzModalModule],
  templateUrl: './courier-fake-attempts.html',
  styleUrl: './courier-fake-attempts.css',
})
export class CourierFakeAttempts implements OnInit {
  // ===== CONFIGS =====
  bulkFormConfig = { ...COURIER_FAKE_ATTEMPTS_FORM };
  editFormConfig = { ...COURIER_FAKE_ATTEMPTS_EDIT_FORM };
  formConfig: any = { ...COURIER_FAKE_ATTEMPTS_FORM };

  tableConfig = structuredClone(COURIER_FAKE_ATTEMPTS_TABLE);

  // ===== STATE =====
  showModal = false;
  data: any = {};
  tableData: any[] = [];

  // ===== EDIT MODE (future) =====
  isEditMode = false;
  editingRow: any = null;

  private suppressChanges = false;

  private readonly REQUIRED_COLUMNS = [
    'CNNo',
    'BranchName',
    'Attempts',
    'CourierID',
    'Rider',
    'Fake_Attempts',
    'Date',
    'IsArchived',
  ];

  constructor(
    private fakeService: CourierFakeAttemptsService,
    private router: Router,
    private notification: NzNotificationService,
    private modal: NzModalService,
    private auth: AuthService
  ) { }

  ngOnInit(): void {
    if (!this.auth.hasRole('CS') && !this.auth.hasRole('ADMIN')) {
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
    this.fakeService.getAll().subscribe({
      next: (res: any) => {
        const rows = res?.data ?? res ?? [];

        const mappedRows = (rows || []).map((r: any) => {
          const cnNo = r.CNNo ?? r.CNNO ?? r.cnNo ?? '';

          const dateStr = this.isoDateOnly(r.Date ?? r.DATE ?? r.date);
          const createdOnStr = this.isoDateTime(r.CreatedOn ?? r.createdOn);

          const isArchivedVal = r.IsArchived ?? r.isArchived;

          return {
            id: r.ID ?? r.Id ?? cnNo,

            cnNo: String(cnNo ?? ''),
            branchName: String(r.BranchName ?? r.branchName ?? 'NA') || 'NA',
            attempts: r.Attempts ?? r.attempts ?? '',
            courierId: String(r.CourierID ?? r.courierId ?? ''),
            rider: String(r.Rider ?? r.rider ?? 'NA') || 'NA',
            fakeAttempts: r.Fake_Attempts ?? r.fakeAttempts ?? '',

            date: dateStr ? new Date(dateStr) : null,
            dateDisplay: dateStr || '',

            isArchived: isArchivedVal,
            isArchivedDisplay:
              typeof isArchivedVal === 'boolean'
                ? isArchivedVal
                  ? '1'
                  : '0'
                : String(isArchivedVal ?? '-'),

            createdBy: String(r.CreatedBy ?? r.createdBy ?? '-'),
            createdOnDisplay: createdOnStr || '-',
          };
        });

        this.tableData = mappedRows;

        const branchValues = mappedRows
          .map((x: any) => x.branchName)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== 'NA');

        const riderValues = mappedRows
          .map((x: any) => x.rider)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== 'NA');

        const branchOptions = [...new Set<string>(branchValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        const riderOptions = [...new Set<string>(riderValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        this.tableConfig = {
          ...this.tableConfig,
          columns: this.tableConfig.columns.map((col: any) => {
            if (col.key === 'branchName') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'BranchName',
                  options: branchOptions,
                },
              };
            }

            if (col.key === 'rider') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'Rider',
                  options: riderOptions,
                },
              };
            }

            return col;
          }),
        };
      },
      error: () =>
        this.notification.error('Error', 'Failed to load fake attempts list'),
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
      this.router.navigate(['/courier-fake-attempts-bulk-preview'], { state: { file } });
      return;
    }
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

            if (!headers.length) {
              this.showInvalidFile('CSV file has no header row. Please upload a valid file.');
              resolve(false);
              return;
            }

            resolve(this.validateHeaders(headers));
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

          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

          if (!rows?.length || !rows[0]?.length) {
            this.showInvalidFile('Excel file is empty or header row is missing.');
            resolve(false);
            return;
          }

          const headers = (rows[0] as any[]).map((h) => String(h ?? '').trim()).filter(Boolean);

          if (!headers.length) {
            this.showInvalidFile('Excel header row is empty. Please upload a valid file.');
            resolve(false);
            return;
          }

          resolve(this.validateHeaders(headers));
        } catch {
          this.showInvalidFile('Unable to read Excel file. Please upload a valid file.');
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

  private validateHeaders(headers: string[]): boolean {
    const normalized = headers.map((h) => this.normalizeHeader(h));
    const set = new Set(normalized);

    const required = this.REQUIRED_COLUMNS.map((c) => this.normalizeHeader(c));
    const missing = required.filter((c) => !set.has(c));

    if (missing.length) {
      this.showInvalidFile(`Missing required columns: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  // ===== helpers =====
  private isoDateOnly(v: any): string {
    const s = String(v ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return '';
  }

  private isoDateTime(v: any): string {
    const s = String(v ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.replace('T', ' ').slice(0, 19);
    return s || '';
  }
}
