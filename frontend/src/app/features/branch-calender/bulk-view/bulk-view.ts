import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { RouterLink } from '@angular/router';
import { BranchWiseCalenderService } from '../../../core/services/branch-wise-calender-service';

interface BulkCalRow {
  rowNo: number;
  uid: number;

  branch: string | null; // BranchID or BranchName

  calDate: Date | null;
  calDateControl: FormControl<Date | null>;

  isNotWorkingDay: number; // 0/1
  notWorkingDayDesc: string | null;

  isArchived: number; // 0/1

  checked: boolean;
  errors?: string[];
  isValid?: boolean;

  rawBranch?: string;
  rawCalDate?: string;
  rawIsNotWorking?: string;
  rawDesc?: string;
  rawIsArchived?: string;
}

@Component({
  selector: 'app-bulk-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzDatePickerModule,
    NzModalModule,
    NzSpinModule,
    RouterLink,
  ],
  templateUrl: './bulk-view.html',
  styleUrl: './bulk-view.css',
})
export class BulkView {
  file!: File;
  private uidCounter = 0;

  rows: BulkCalRow[] = [];
  checkAll = false;
  bulkSaving = false;

  fileHeaders: string[] = [];
  columnMap: any = {};

  isLoading = true;
  loadingText = 'Reading file & validating...';

  private localValidateTimer: any = null;

  // ✅ required logic (Tran removed)
  readonly REQUIRED_BASE = ['CALENDER_DATE', 'ISNOTWORKINGDAY', 'NOTWORKINGDAYDESC', 'ISARCHIVED'];
  readonly BRANCH_KEYS = ['BRANCHID', 'BRANCH_NAME', 'BRANCHNAME'];

  // errors
  private readonly BR_REQ = 'BRANCH is required';
  private readonly DATE_REQ = 'CALENDER_DATE is required';
  private readonly BAD_DATE = 'Invalid Date';
  private readonly BAD_NWD = 'ISNOTWORKINGDAY must be 0 or 1';
  private readonly DESC_REQ = 'NOTWORKINGDAYDESC is required';
  private readonly BAD_ARCH = 'IsArchived must be 0 or 1';
  private readonly BR_BAD = 'BRANCHID must be numeric (max 5 digits)';

  constructor(
    private calService: BranchWiseCalenderService,
    private notification: NzNotificationService,
    private modal: NzModalService
  ) { }

  async ngOnInit(): Promise<void> {
    const state = history.state;
    this.file = state?.file;

    if (!this.file) {
      this.toast('error', 'No File', 'No file received');
      this.isLoading = false;
      return;
    }

    this.parseFile(this.file);
  }

  trackByRow = (_: number, r: BulkCalRow) => r.uid;

  toast(type: 'success' | 'error' | 'warning' | 'info', title: string, msg: string) {
    (this.notification as any)[type](title, msg, { nzDuration: 5000 });
  }

  hasErr(row: BulkCalRow, msg: string): boolean {
    return (row.errors ?? []).includes(msg);
  }

  // --------------- parsing ---------------
  parseFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') this.parseCSV(file);
    else if (ext === 'xls' || ext === 'xlsx') this.parseExcel(file);
    else {
      this.toast('error', 'Invalid File', 'Unsupported file format (only CSV/XLS/XLSX)');
      this.isLoading = false;
    }
  }

  parseCSV(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => String(h ?? '').replace(/^\uFEFF/, '').trim(),
      complete: (res: any) => {
        this.fileHeaders = (res?.meta?.fields || []).map((h: any) => String(h ?? '').trim());
        if (!this.fileHeaders.length) {
          this.toast('error', 'Invalid File', 'CSV has no header row.');
          this.isLoading = false;
          return;
        }
        this.handleHeaderValidation(res.data || []);
      },
      error: () => {
        this.toast('error', 'Invalid File', 'Unable to read CSV file.');
        this.isLoading = false;
      },
    });
  }

  parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = wb.SheetNames?.[0];
        const sheet = wb.Sheets?.[sheetName];

        if (!sheetName || !sheet) {
          this.toast('error', 'Invalid File', 'Excel file has no sheet.');
          this.isLoading = false;
          return;
        }

        const rowsHeader: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
        if (!rowsHeader?.length || !rowsHeader[0]?.length) {
          this.toast('error', 'Invalid File', 'Excel file is empty or missing header row.');
          this.isLoading = false;
          return;
        }

        this.fileHeaders = (rowsHeader[0] as any[])
          .map((h) => String(h ?? '').trim())
          .filter(Boolean);

        if (!this.fileHeaders.length) {
          this.toast('error', 'Invalid File', 'Excel header row is empty.');
          this.isLoading = false;
          return;
        }

        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        this.handleHeaderValidation(json || []);
      } catch {
        this.toast('error', 'Invalid File', 'Unable to read Excel file.');
        this.isLoading = false;
      }
    };

    reader.onerror = () => {
      this.toast('error', 'Invalid File', 'Unable to read file.');
      this.isLoading = false;
    };

    reader.readAsBinaryString(file);
  }

  // --------------- header validation + mapping ---------------
  private normHeader(h: any): string {
    return String(h ?? '')
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  private handleHeaderValidation(data: any[]) {
    const set = new Set(this.fileHeaders.map((h) => this.normHeader(h)));

    const missingBase = this.REQUIRED_BASE.map((c) => this.normHeader(c)).filter((c) => !set.has(c));
    const hasBranch = this.BRANCH_KEYS.map((k) => this.normHeader(k)).some((k) => set.has(k));

    const missing: string[] = [];
    if (missingBase.length) missing.push(...missingBase);
    if (!hasBranch) missing.push('BRANCHID/BRANCHNAME');

    if (missing.length) {
      this.toast('error', 'Invalid File', `Missing required columns: ${missing.join(', ')}`);
      this.isLoading = false;
      return;
    }

    this.autoMapColumns();
    this.mapRows(data);
    this.isLoading = false;
  }

  private autoMapColumns() {
    const headerMap = new Map<string, string>();
    for (const h of this.fileHeaders) headerMap.set(this.normHeader(h), h);

    const pick = (candidates: string[]) => {
      for (const c of candidates) {
        const found = headerMap.get(this.normHeader(c));
        if (found) return found;
      }
      return null;
    };

    // required
    this.columnMap['BRANCH'] = pick(['BRANCHID', 'BRANCH_NAME', 'BRANCHNAME']);

    // base
    this.columnMap['CALENDER_DATE'] = pick(['CALENDER_DATE', 'CALENDERDATE', 'CALENDAR_DATE', 'DATE']);
    this.columnMap['ISNOTWORKINGDAY'] = pick(['ISNOTWORKINGDAY', 'IS_NOT_WORKING_DAY']);
    this.columnMap['NOTWORKINGDAYDESC'] = pick(['NOTWORKINGDAYDESC', 'NOT_WORKING_DAY_DESC', 'DESCRIPTION']);
    this.columnMap['ISARCHIVED'] = pick(['ISARCHIVED', 'IS_ARCHIVED']);
  }

  // --------------- rows mapping + validations ---------------
  private mapRows(data: any[]) {
    if (!this.uidCounter) this.uidCounter = Date.now();

    const getVal = (rowObj: any, key: string) => rowObj?.[this.columnMap[key]];

    this.rows = (data || []).map((r, i) => {
      const errors: string[] = [];

      const rawBranch = String(getVal(r, 'BRANCH') ?? '').trim();
      const rawCalDate = String(getVal(r, 'CALENDER_DATE') ?? '').trim();
      const rawIsNotWorking = String(getVal(r, 'ISNOTWORKINGDAY') ?? '').trim();
      const rawDesc = String(getVal(r, 'NOTWORKINGDAYDESC') ?? '').trim();
      const rawIsArchived = String(getVal(r, 'ISARCHIVED') ?? '').trim();

      const branch = rawBranch || null;
      if (!branch) errors.push(this.BR_REQ);
      else if (!this.isValidBranchId(branch)) errors.push(this.BR_BAD);

      const calDate = this.parseAnyDate(rawCalDate);
      if (!rawCalDate) errors.push(this.DATE_REQ);
      else if (!calDate) errors.push(this.BAD_DATE);

      const isNotWorkingDay = this.parse01(rawIsNotWorking);
      if (isNotWorkingDay === null) errors.push(this.BAD_NWD);

      const notWorkingDayDesc = rawDesc || null;
      if (!notWorkingDayDesc) errors.push(this.DESC_REQ);

      const isArchived = this.parse01(rawIsArchived);
      if (isArchived === null) errors.push(this.BAD_ARCH);

      return {
        uid: ++this.uidCounter,
        rowNo: i + 1,

        rawBranch,
        rawCalDate,
        rawIsNotWorking,
        rawDesc,
        rawIsArchived,

        branch,

        calDate,
        calDateControl: new FormControl<Date | null>(calDate),

        isNotWorkingDay: isNotWorkingDay ?? 0,
        notWorkingDayDesc,

        isArchived: isArchived ?? 0,

        checked: false,
        errors,
        isValid: false,
      };
    });

    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
    this.checkDuplicateInFile();
  }

  private parse01(v: any): number | null {
    const s = String(v ?? '').trim();
    if (s === '') return null;
    const n = Number(s);
    return n === 0 || n === 1 ? n : null;
  }

  private applyLocalValidations() {
    for (const row of this.rows) {
      row.errors = [];

      const br = String(row.branch ?? '').trim();
      if (!br) row.errors.push(this.BR_REQ);
      else if (!this.isValidBranchId(br)) row.errors.push(this.BR_BAD);

      const dt = row.calDateControl?.value;
      if (!dt) {
        if (!String(row.rawCalDate ?? '').trim()) row.errors.push(this.DATE_REQ);
        else row.errors.push(this.BAD_DATE);
      }

      if (!(Number(row.isNotWorkingDay) === 0 || Number(row.isNotWorkingDay) === 1)) row.errors.push(this.BAD_NWD);
      if (!String(row.notWorkingDayDesc ?? '').trim()) row.errors.push(this.DESC_REQ);
      if (!(Number(row.isArchived) === 0 || Number(row.isArchived) === 1)) row.errors.push(this.BAD_ARCH);
    }

    this.updateHasValidRow();
    this.checkDuplicateInFile();
    this.enforceSelectionRules();
  }

  private applyLocalValidationsSafe() {
    if (this.localValidateTimer) return;
    this.localValidateTimer = setTimeout(() => {
      this.localValidateTimer = null;
      this.applyLocalValidations();
    }, 80);
  }

  isRowValid(row: BulkCalRow): boolean {
    return (
      (row.errors?.length ?? 0) === 0 &&
      !!String(row.branch ?? '').trim() &&
      !!row.calDateControl?.value &&
      (Number(row.isNotWorkingDay) === 0 || Number(row.isNotWorkingDay) === 1) &&
      !!String(row.notWorkingDayDesc ?? '').trim() &&
      (Number(row.isArchived) === 0 || Number(row.isArchived) === 1)
    );
  }

  updateHasValidRow() {
    for (const r of this.rows) {
      r.isValid = this.isRowValid(r);
      if (!r.isValid || this.hasErrLike(r, 'Duplicate with row')) r.checked = false;
    }

    const validRows = this.rows.filter((r) => r.isValid && !this.hasErrLike(r, 'Duplicate with row'));
    this.checkAll = validRows.length > 0 && validRows.every((r) => r.checked);
  }

  // --------------- UI events ---------------
  onToggleAll(checked: boolean) {
    this.checkAll = checked;
    this.rows.forEach((r) => (r.checked = checked ? !!r.isValid : false));
    this.checkAll = this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
  }

  onRowToggle(row: BulkCalRow, checked: boolean) {
    const canSelect = !!row.isValid && !this.hasErrLike(row, 'Duplicate with row');
    row.checked = checked && canSelect;
    this.enforceSelectionRules();
  }

  onRowDateChange(row: BulkCalRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowTextChange(row: BulkCalRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  // --------------- proceed ---------------
  get selectedValidCount(): number {
    return this.rows.filter((r) => r.checked && r.isValid).length;
  }

  get canProceed(): boolean {
    return this.selectedValidCount >= 1 && !this.bulkSaving && !this.isLoading;
  }

  async proceedBulkImport() {
    const selected = this.rows.filter((r) => r.checked && r.isValid);
    if (!selected.length) return;

    this.bulkSaving = true;

    const payloads = selected
      .map((r) => ({
        Branch: String(r.branch || '').trim(),
        Calender_Date: r.calDateControl.value ? this.toYMD(r.calDateControl.value) : null,
        IsNotWorkingDay: Number(r.isNotWorkingDay),
        NotWorkingDayDesc: String(r.notWorkingDayDesc || '').trim(),
        IsArchived: Number(r.isArchived),
      }))
      .filter((p) => p.Branch && p.Calender_Date);

    try {
      const chunks = this.chunk(payloads, 200);

      let totalInserted = 0;
      let totalUpdated = 0;
      let serverMessage = '';

      for (const ch of chunks) {
        const res: any = await new Promise((resolve, reject) => {
          this.calService.importBulk(ch).subscribe({
            next: (response) => resolve(response),
            error: (e) => reject(e),
          });
        });

        if (res?.data) {
          totalInserted += Number(res.data.inserted || 0);
          totalUpdated += Number(res.data.updated || 0);
        }
        if (res?.message) serverMessage = res.message;
      }

      this.toast('success', 'Success', serverMessage || `Inserted: ${totalInserted}, Updated: ${totalUpdated}`);
      this.removeRowsRef(selected);
    } catch (e: any) {
      this.toast('error', 'Error', e?.error?.message || e?.message || 'Bulk import failed');
    } finally {
      this.bulkSaving = false;
    }
  }

  // --------------- duplicates ---------------
  private checkDuplicateInFile() {
    const map = new Map<string, BulkCalRow[]>();

    for (const row of this.rows) {
      const branch = String(row.branch ?? '').trim();
      const dt = row.calDateControl?.value ? this.toYMD(row.calDateControl.value) : '';
      if (!branch || !dt) continue;

      // ✅ Backend-aligned KEY: Branch + Date
      const key = `${branch}|${dt}`;

      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }

    for (const row of this.rows) {
      row.errors = (row.errors ?? []).filter((e) => !e.startsWith('Duplicate with row'));
    }

    map.forEach((rows) => {
      if (rows.length > 1) {
        const rowNos = rows.map((r) => r.rowNo).join(', ');
        rows.forEach((r) => {
          r.errors = r.errors ?? [];
          r.errors.push(`Duplicate with row(s): ${rowNos}`);
          r.checked = false;
        });
      }
    });

    this.enforceSelectionRules();
  }

  hasErrLike(row: BulkCalRow, prefix: string): boolean {
    return (row.errors ?? []).some((e) => String(e).startsWith(prefix));
  }

  private enforceSelectionRules() {
    for (const r of this.rows) {
      r.isValid = this.isRowValid(r);
      if (!r.isValid || this.hasErrLike(r, 'Duplicate with row')) r.checked = false;
    }
    const validRows = this.rows.filter((r) => r.isValid && !this.hasErrLike(r, 'Duplicate with row'));
    this.checkAll = validRows.length > 0 && validRows.every((r) => r.checked);
  }

  // --------------- helpers ---------------
  private removeRowsRef(rowsToRemove: BulkCalRow[]) {
    const set = new Set(rowsToRemove);
    this.rows = this.rows.filter((r) => !set.has(r));
    this.rows.forEach((r, i) => (r.rowNo = i + 1));
    this.updateHasValidRow();
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private toYMD(d: Date): string {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private parseAnyDate(raw: string): Date | null {
    const s = String(raw ?? '').trim();
    if (!s) return null;

    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const y = +iso[1];
      const mo = +iso[2];
      const da = +iso[3];
      const d = new Date(y, mo - 1, da);
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  getErrLike(row: BulkCalRow, prefix: string): string | null {
    return (row.errors ?? []).find((e) => String(e).startsWith(prefix)) ?? null;
  }

  private isValidBranchId(v: any): boolean {
    const s = String(v ?? '').trim();
    return /^[0-9]{1,5}$/.test(s);
  }
}