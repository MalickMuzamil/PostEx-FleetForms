import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../core/services/auth-service';
import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { CALL_LOGS_FORM, CALL_LOGS_EDIT_FORM, CALL_LOGS_TABLE } from './call-logs-config';
import { CallLogsService } from '../../core/services/call-logs-service';

@Component({
  selector: 'app-call-logs',
  standalone: true,
  imports: [CommonModule, Table, Modal, NzModalModule],
  templateUrl: './call-logs.html',
  styleUrl: './call-logs.css',
})
export class CallLogs implements OnInit {
  bulkFormConfig = { ...CALL_LOGS_FORM };
  editFormConfig = { ...CALL_LOGS_EDIT_FORM };
  formConfig: any = { ...CALL_LOGS_FORM };

  tableConfig = structuredClone(CALL_LOGS_TABLE);

  showModal = false;
  data: any = {};
  tableData: any[] = [];
  loading: boolean = true;

  isEditMode = false;
  editingRow: any = null;
  private suppressChanges = false;

  // ✅ EXACT required columns (as DB / file columns)
  private readonly REQUIRED_COLUMNS = [
    'Customer_Number',
    'Consignee_Cell_Length',
    'Master_No',
    'Agent Duration',
    'Total Duration',
    'Extension',
    'Call_Response',
    'Time',
    'Recording',
  ];

  constructor(
    private callLogsService: CallLogsService,
    private router: Router,
    private notification: NzNotificationService,
    private modal: NzModalService,
    private auth: AuthService
  ) { }

  get canAddCallLogs(): boolean {
    return this.auth.hasRole('ADMIN') || this.auth.hasRole('IT');
  }

  ngOnInit(): void {
    if (!this.auth.hasRole('ADMIN') && !this.auth.hasRole('IT')) {
      this.router.navigate(['/']);
      return;
    }

    this.loadTable();
  }

  // ---------------- TABLE ----------------
  loadTable() {
    this.callLogsService.getAll().subscribe({
      next: (res: any) => {
        const rows = res?.data ?? res ?? [];

        this.tableData = (rows || []).map((r: any) => {
          this.loading = false;
          const timeStr = this.isoDateTime(r.Time ?? r.time);

          const isArchivedVal = r.IsArchived ?? r.isArchived;

          // durations might be seconds or hh:mm:ss from backend
          const agentDurRaw = r['Agent Duration'] ?? r.AgentDuration ?? r.agentDuration ?? '';
          const totalDurRaw = r['Total Duration'] ?? r.TotalDuration ?? r.totalDuration ?? '';

          return {
            id: r.ID ?? r.Id ?? `${r.Customer_Number ?? ''}-${timeStr ?? ''}`,

            customerNumber: String(r.Customer_Number ?? r.customerNumber ?? ''),
            consigneeCellLength: String(r.Consignee_Cell_Length ?? r.consigneeCellLength ?? ''),
            masterNo: String(r.Master_No ?? r.masterNo ?? ''),

            agentDuration: agentDurRaw,
            agentDurationDisplay: String(agentDurRaw ?? '-'),

            totalDuration: totalDurRaw,
            totalDurationDisplay: String(totalDurRaw ?? '-'),

            extension: String(r.Extension ?? r.extension ?? ''),
            callResponse: String(r.Call_Response ?? r.callResponse ?? ''),
            time: timeStr ? new Date(timeStr.replace(' ', 'T')) : null,
            timeDisplay: timeStr || '-',

            recording: String(r.Recording ?? r.recording ?? ''),
          };
        });

        const customerValues = this.tableData
          .map((x: any) => x.customerNumber)
          .filter((x: any): x is string => typeof x === 'string' && !!x);

        const masterValues = this.tableData
          .map((x: any) => x.masterNo)
          .filter((x: any): x is string => typeof x === 'string' && !!x);

        const responseValues = this.tableData
          .map((x: any) => x.callResponse)
          .filter((x: any): x is string => typeof x === 'string' && !!x);

        const customerOptions = [...new Set<string>(customerValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({ label: x, value: x }));

        const masterOptions = [...new Set<string>(masterValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({ label: x, value: x }));

        const responseOptions = [...new Set<string>(responseValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({ label: x, value: x }));

        this.tableConfig = {
          ...this.tableConfig,
          columns: this.tableConfig.columns.map((col: any) => {

            if (col.key === 'customerNumber') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  options: customerOptions,
                },
              };
            }

            if (col.key === 'masterNo') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  options: masterOptions,
                },
              };
            }

            if (col.key === 'callResponse') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  options: responseOptions,
                },
              };
            }

            return col;
          }),
        };
      },
      error: () => this.notification.error('Error', 'Failed to load call logs list'),
    });
  }

  // ---------------- MODAL ----------------
  openAddForm() {
    if (!this.canAddCallLogs) {
      this.notification.error('Unauthorized', 'Only Admin or IT can add call logs.');
      return;
    }

    this.isEditMode = false;
    this.editingRow = null;

    this.formConfig = { ...this.bulkFormConfig };
    this.data = {};
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  // ---------------- FORM CHANGE ----------------
  async onFormChange(evt: { key: string; value: any; formValue: any }) {
    if (this.suppressChanges) return;

    if (!this.isEditMode && evt.key === 'bulkImport' && evt.value) {
      const file: File = evt.value;
      const isValid = await this.validateBulkFile(file);
      if (!isValid) return;

      this.showModal = false;
      this.router.navigate(['/call-logs-bulk-preview'], { state: { file } });
      return;
    }
  }

  // ---------------- FILE VALIDATION ----------------
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

      // CSV
      if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res: any) => {
            const headers: string[] = res?.meta?.fields ?? [];
            if (!headers.length) {
              this.showInvalidFile('CSV file has no header row.');
              resolve(false);
              return;
            }
            resolve(this.validateHeaders(headers));
          },
          error: () => {
            this.showInvalidFile('Unable to read CSV file.');
            resolve(false);
          },
        });
        return;
      }

      // XLS/XLSX
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
            this.showInvalidFile('Excel header row is empty.');
            resolve(false);
            return;
          }

          resolve(this.validateHeaders(headers));
        } catch {
          this.showInvalidFile('Unable to read Excel file.');
          resolve(false);
        }
      };

      reader.onerror = () => {
        this.showInvalidFile('Unable to read file.');
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

  // helpers
  private isoDateTime(v: any): string {
    const s = String(v ?? '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.replace('T', ' ').slice(0, 19);
    return s;
  }
}
