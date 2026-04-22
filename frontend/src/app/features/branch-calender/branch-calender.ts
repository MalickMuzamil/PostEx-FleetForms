import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';

import { Table } from '../../ui/table/table';
import { Modal } from '../../ui/modal/modal';

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { BRANCH_WISE_CALENDER_FORM, BRANCH_WISE_CALENDER_TABLE } from './branch-calender-config';
import { BranchWiseCalenderService } from '../../core/services/branch-wise-calender-service';

@Component({
  selector: 'app-branch-calender',
  standalone: true,
  imports: [Table, Modal, NzModalModule],
  templateUrl: './branch-calender.html',
  styleUrl: './branch-calender.css',
})
export class BranchCalender implements OnInit {
  formConfig: any = { ...BRANCH_WISE_CALENDER_FORM };
  tableConfig = BRANCH_WISE_CALENDER_TABLE;

  showModal = false;
  data: any = {};
  tableData: any[] = [];
  loading: boolean = true;

  // ✅ REQUIRED (backend aligned) - Tran is NOT required now
  private readonly REQUIRED_BASE = ['CALENDER_DATE', 'ISNOTWORKINGDAY', 'NOTWORKINGDAYDESC', 'ISARCHIVED'];
  private readonly BRANCH_KEYS = ['BRANCHID', 'BRANCH_NAME', 'BRANCHNAME'];

  constructor(
    private calService: BranchWiseCalenderService,
    private router: Router,
    private notification: NzNotificationService,
    private modal: NzModalService
  ) { }

  ngOnInit(): void {
    this.loadTable();
  }

  // ================= TABLE =================
  loadTable() {
    this.calService.getAll().subscribe({
      next: (res: any) => {
        const rows = res?.data ?? res ?? [];

        const mappedRows = (rows || []).map((r: any) => {
          const calDate = this.isoDateOnly(
            r.CALENDER_DATE ?? r.calenderDate ?? r.CalendarDate
          );

          const isNotWorking = r.ISNOTWORKINGDAY ?? r.isNotWorkingDay;
          const isArchived = r.IsArchived ?? r.isArchived;

          const branchId = r.BRANCHID ?? r.branchId;
          const branchName = r.BranchName ?? r.branchName;

          const tranId = r.TRAN_ID ?? r.TRANID ?? r.tranId;
          const tranName = r.TranName ?? r.tranName;

          return {
            id: r.ID ?? `${branchId ?? branchName}-${calDate ?? ''}`,

            tranDisplay: tranId ?? tranName ?? '-',
            branchDisplay: branchId ?? branchName ?? '-',

            calenderDate: calDate ? new Date(calDate) : null,
            calenderDateDisplay: calDate || '',

            isNotWorkingDay: isNotWorking,
            isNotWorkingDayDisplay:
              typeof isNotWorking === 'boolean'
                ? (isNotWorking ? '1' : '0')
                : String(isNotWorking ?? '-'),

            notWorkingDayDesc: String(
              r.NOTWORKINGDAYDESC ?? r.notWorkingDayDesc ?? 'NA'
            ) || 'NA',

            isArchived: isArchived,
            isArchivedDisplay:
              typeof isArchived === 'boolean'
                ? (isArchived ? '1' : '0')
                : String(isArchived ?? '-'),

            createdBy: String(r.CreatedBy ?? r.createdBy ?? '-'),
            createdOnDisplay: this.isoDateTime(r.CreatedOn ?? r.createdOn) || '-',
          };
        });

        this.tableData = mappedRows;
        this.loading = false;

        const workingDayValues = mappedRows
          .map((x: any) => x.isNotWorkingDayDisplay)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== '-');

        const descValues = mappedRows
          .map((x: any) => x.notWorkingDayDesc)
          .filter((x: any): x is string => typeof x === 'string' && !!x && x !== 'NA');

        const workingDayOptions = [...new Set<string>(workingDayValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        const descOptions = [...new Set<string>(descValues)]
          .sort((a, b) => a.localeCompare(b))
          .map((x) => ({
            label: x,
            value: x,
          }));

        this.tableConfig = {
          ...this.tableConfig,
          columns: this.tableConfig.columns.map((col: any) => {
            if (col.key === 'isNotWorkingDayDisplay') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'ISNOTWORKINGDAY',
                  options: workingDayOptions,
                },
              };
            }

            if (col.key === 'notWorkingDayDesc') {
              return {
                ...col,
                filter: {
                  ...col.filter,
                  type: 'select',
                  placeholder: 'NOTWORKINGDAYDESC',
                  options: descOptions,
                },
              };
            }

            return col;
          }),
        };
      },
      error: () =>
        this.notification.error('Error', 'Failed to load Branch Wise Calender list'),
    });
  }

  // ================= MODAL =================
  openAddForm() {
    this.formConfig = { ...BRANCH_WISE_CALENDER_FORM };
    this.data = {};
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  // ================= FORM CHANGE =================
  async onFormChange(evt: { key: string; value: any; formValue: any }) {
    if (evt.key === 'bulkImport' && evt.value) {
      const file: File = evt.value;
      const isValid = await this.validateBulkFile(file);
      if (!isValid) return;

      this.showModal = false;
      this.router.navigate(['/branch-calender-bulk-preview'], { state: { file } });
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

    // base required
    const missingBase = this.REQUIRED_BASE
      .map((c) => this.normalizeHeader(c))
      .filter((c) => !set.has(c));

    // branch: at least one
    const hasBranch = this.BRANCH_KEYS.map((k) => this.normalizeHeader(k)).some((k) => set.has(k));

    const missing: string[] = [];
    if (missingBase.length) missing.push(...missingBase);
    if (!hasBranch) missing.push('BRANCHID/BRANCHNAME');

    if (missing.length) {
      this.showInvalidFile(`Missing required columns: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

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