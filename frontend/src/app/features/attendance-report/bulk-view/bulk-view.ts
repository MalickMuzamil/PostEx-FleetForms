import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { RouterLink } from '@angular/router';
import { AttendanceService } from '../../../core/services/attendance-service';

interface BulkAttendanceRow {
  rowNo: number;
  uid: number;

  empId: string | null;
  empName?: string | null;

  designation?: string | null;
  division?: string | null;
  zone?: string | null;
  branch?: string | null;
  department?: string | null;
  function?: string | null;
  area?: string | null;
  shift?: string | null;
  shiftTime?: string | null;

  date: Date | null;
  dateControl: FormControl<Date | null>;

  inTime: string | null;
  outTime: string | null;

  isArchived: number;

  checked: boolean;
  saving?: boolean;
  errors?: string[];
  isValid?: boolean;

  rawEmpId?: string;
  rawEmpName?: string;

  rawDesignation?: string;
  rawDivision?: string;
  rawZone?: string;
  rawBranch?: string;
  rawDepartment?: string;
  rawFunction?: string;
  rawArea?: string;
  rawShift?: string;
  rawShiftTime?: string;

  rawDate?: string;
  rawInTime?: string;
  rawOutTime?: string;
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
export class BulkView implements OnInit {
  file!: File;
  private uidCounter = 0;

  // ---------- errors ----------
  private readonly EMP_REQUIRED = 'EMP_ID is required';
  private readonly EMP_INVALID = 'EMP_ID: Invalid format';

  private readonly DATE_REQUIRED = 'DATE is required';
  private readonly INVALID_DATE = 'Invalid DATE';

  private readonly IN_REQUIRED = 'IN_TIME is required';
  private readonly OUT_REQUIRED = 'OUT_TIME is required';
  private readonly INVALID_TIME = 'Invalid time format (HH:mm)';

  private readonly ARCH_REQUIRED = 'IsArchived is required';
  private readonly INVALID_ARCH = 'IsArchived must be 0 or 1';

  private readonly EMP_NAME_REQUIRED = 'EMP_NAME is required';
  private readonly DESIGNATION_REQUIRED = 'DESIGNATION is required';
  private readonly DIVISION_REQUIRED = 'DIVISION is required';
  private readonly ZONE_REQUIRED = 'ZONE is required';
  private readonly BRANCH_REQUIRED = 'BRANCH is required';
  private readonly DEPARTMENT_REQUIRED = 'DEPARTMENT is required';
  private readonly FUNCTION_REQUIRED = 'FUNCTION is required';
  private readonly AREA_REQUIRED = 'AREA is required';
  private readonly SHIFT_REQUIRED = 'SHIFT is required';
  private readonly SHIFT_TIME_REQUIRED = 'SHIFT_TIME is required';

  // text fields errors
  private readonly NO_NUM = (label: string) => `${label}: Numbers not allowed`;
  private readonly SHIFT_TIME_INVALID = 'SHIFT_TIME: Invalid format (HH:mm-HH:mm)';

  // required columns (strict)
  readonly REQUIRED_COLUMNS = ['EMP_ID', 'DATE', 'IN_TIME', 'OUT_TIME', 'IsArchived'];

  rows: BulkAttendanceRow[] = [];
  checkAll = false;
  bulkSaving = false;
  hasValidRow = false;

  fileHeaders: string[] = [];
  columnMap: any = {};

  isLoading = true;
  loadingText = 'Reading file & validating...';

  private localValidateTimer: any = null;
  private readonly MAX_LEN = 20;
  private readonly TOO_LONG = (label: string) => `${label}: Max ${this.MAX_LEN} characters allowed`;

  searchTerm = '';
  statusFilter: 'all' | 'valid' | 'invalid' | 'selected' = 'all';

  constructor(
    private attendanceService: AttendanceService,
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

    this.isLoading = true;
    this.loadingText = 'Reading file & validating...';
    this.parseFile(this.file);
  }

  trackByRow = (_: number, r: BulkAttendanceRow) => r.uid;

  toast(type: 'success' | 'error' | 'warning' | 'info', title: string, msg: string) {
    (this.notification as any)[type](title, msg, { nzDuration: 5000 });
  }

  hasErr(row: BulkAttendanceRow, msg: string): boolean {
    return (row.errors ?? []).includes(msg);
  }

  // ---------------- FILE PARSING ----------------
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

  // ---------------- HEADER VALIDATION & MAPPING ----------------
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
    const headerSet = new Set(this.fileHeaders.map((h) => this.normHeader(h)));
    const required = this.REQUIRED_COLUMNS.map((c) => this.normHeader(c));
    const missing = required.filter((c) => !headerSet.has(c));

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
    this.columnMap['EMP_ID'] = pick(['EMP_ID', 'EMPID', 'EMP ID']);
    this.columnMap['DATE'] = pick(['DATE']);
    this.columnMap['IN_TIME'] = pick(['IN_TIME', 'IN TIME']);
    this.columnMap['OUT_TIME'] = pick(['OUT_TIME', 'OUT TIME']);
    this.columnMap['IsArchived'] = pick(['IsArchived', 'ISARCHIVED', 'Is_Archived']);

    // optional
    this.columnMap['EMP_NAME'] = pick(['EMP_NAME', 'EMP NAME']);
    this.columnMap['DESIGNATION'] = pick(['DESIGNATION']);
    this.columnMap['DIVISION'] = pick(['DIVISION']);
    this.columnMap['ZONE'] = pick(['ZONE']);
    this.columnMap['BRANCH'] = pick(['BRANCH']);
    this.columnMap['DEPARTMENT'] = pick(['DEPARTMENT']);
    this.columnMap['FUNCTION'] = pick(['FUNCTION']);
    this.columnMap['AREA'] = pick(['AREA']);
    this.columnMap['SHIFT'] = pick(['SHIFT']);
    this.columnMap['SHIFT_TIME'] = pick(['SHIFT_TIME', 'SHIFT TIME']);
  }

  // ---------------- ROW MAPPING ----------------
  private mapRows(data: any[]) {
    if (!this.uidCounter) this.uidCounter = Date.now();

    const getVal = (rowObj: any, key: string) => rowObj?.[this.columnMap[key]];

    this.rows = (data || []).map((r, i) => {
      const errors: string[] = [];

      const rawEmpId = String(getVal(r, 'EMP_ID') ?? '').trim();
      const rawDate = String(getVal(r, 'DATE') ?? '').trim();
      const rawInTime = String(getVal(r, 'IN_TIME') ?? '').trim();
      const rawOutTime = String(getVal(r, 'OUT_TIME') ?? '').trim();
      const rawIsArchived = String(getVal(r, 'IsArchived') ?? '').trim();

      const rawEmpName = String(getVal(r, 'EMP_NAME') ?? '').trim();
      const rawDesignation = String(getVal(r, 'DESIGNATION') ?? '').trim();
      const rawDivision = String(getVal(r, 'DIVISION') ?? '').trim();
      const rawZone = String(getVal(r, 'ZONE') ?? '').trim();
      const rawBranch = String(getVal(r, 'BRANCH') ?? '').trim();
      const rawDepartment = String(getVal(r, 'DEPARTMENT') ?? '').trim();
      const rawFunction = String(getVal(r, 'FUNCTION') ?? '').trim();
      const rawArea = String(getVal(r, 'AREA') ?? '').trim();
      const rawShift = String(getVal(r, 'SHIFT') ?? '').trim();
      const rawShiftTime = String(getVal(r, 'SHIFT_TIME') ?? '').trim();

      // EMP_ID
      const empId = rawEmpId || null;
      if (!empId) errors.push(this.EMP_REQUIRED);
      else if (!this.isEmpIdValid(empId)) errors.push(this.EMP_INVALID);

      // DATE
      const date = this.parseAnyDate(rawDate);
      if (!rawDate) errors.push(this.DATE_REQUIRED);
      else if (!date) errors.push(this.INVALID_DATE);

      // TIME
      const inTime = rawInTime || null;
      const outTime = rawOutTime || null;

      if (!inTime) errors.push(this.IN_REQUIRED);
      else if (!this.isValidHHmm(inTime)) errors.push(`IN_TIME: ${this.INVALID_TIME}`);

      if (!outTime) errors.push(this.OUT_REQUIRED);
      else if (!this.isValidHHmm(outTime)) errors.push(`OUT_TIME: ${this.INVALID_TIME}`);

      // IsArchived
      let isArchivedNum: number | null = null;
      if (rawIsArchived === '') errors.push(this.ARCH_REQUIRED);
      else {
        const n = Number(rawIsArchived);
        if (n === 0 || n === 1) isArchivedNum = n;
        else errors.push(this.INVALID_ARCH);
      }

      // ✅ ONLY EMP_NAME: numbers not allowed (baqi fields me allowed)
      const checkNoNum = (val: string, label: string) => {
        if (val && /\d/.test(val)) errors.push(this.NO_NUM(label));
      };
      checkNoNum(rawEmpName, 'EMP_NAME');

      // SHIFT_TIME (optional strict format if provided)
      if (rawShiftTime && !this.isValidShiftTime(rawShiftTime)) errors.push(this.SHIFT_TIME_INVALID);

      // ✅ Max length = 20 (initial validation on raw values)
      const checkMax = (val: string, label: string) => {
        if (val && val.length > this.MAX_LEN) errors.push(this.TOO_LONG(label));
      };

      checkMax(rawEmpId, 'EMP_ID');
      checkMax(rawEmpName, 'EMP_NAME');
      checkMax(rawDesignation, 'DESIGNATION');
      checkMax(rawDivision, 'DIVISION');
      checkMax(rawZone, 'ZONE');
      checkMax(rawBranch, 'BRANCH');
      checkMax(rawDepartment, 'DEPARTMENT');
      checkMax(rawFunction, 'FUNCTION');
      checkMax(rawArea, 'AREA');
      checkMax(rawShift, 'SHIFT');
      checkMax(rawShiftTime, 'SHIFT_TIME');
      checkMax(rawInTime, 'IN_TIME');
      checkMax(rawOutTime, 'OUT_TIME');
      checkMax(rawIsArchived, 'IsArchived');

      const row: BulkAttendanceRow = {
        uid: ++this.uidCounter,
        rowNo: i + 1,

        rawEmpId,
        rawEmpName,
        rawDesignation,
        rawDivision,
        rawZone,
        rawBranch,
        rawDepartment,
        rawFunction,
        rawArea,
        rawShift,
        rawShiftTime,
        rawDate,
        rawInTime,
        rawOutTime,
        rawIsArchived,

        empId,
        empName: rawEmpName || null,

        designation: rawDesignation || null,
        division: rawDivision || null,
        zone: rawZone || null,
        branch: rawBranch || null,
        department: rawDepartment || null,
        function: rawFunction || null,
        area: rawArea || null,
        shift: rawShift || null,
        shiftTime: rawShiftTime || null,

        date: date,
        dateControl: new FormControl<Date | null>(date),

        inTime,
        outTime,

        isArchived: isArchivedNum ?? 0,

        checked: false,
        errors,
        isValid: false,
      };

      return row;
    });

    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  // ---------------- ERROR HELPERS ----------------
  private addErr(row: BulkAttendanceRow, msg: string) {
    row.errors = row.errors ?? [];
    if (!row.errors.includes(msg)) row.errors.push(msg);
  }

  private removeErr(row: BulkAttendanceRow, msg: string) {
    row.errors = (row.errors ?? []).filter((e) => e !== msg);
  }

  private clearManagedErrors(row: BulkAttendanceRow) {
    [
      this.EMP_REQUIRED,
      this.EMP_INVALID,
      this.DATE_REQUIRED,
      this.INVALID_DATE,
      this.IN_REQUIRED,
      this.OUT_REQUIRED,
      this.ARCH_REQUIRED,
      this.INVALID_ARCH,
      this.SHIFT_TIME_INVALID,

      this.EMP_NAME_REQUIRED,
      this.DESIGNATION_REQUIRED,
      this.DIVISION_REQUIRED,
      this.ZONE_REQUIRED,
      this.BRANCH_REQUIRED,
      this.DEPARTMENT_REQUIRED,
      this.FUNCTION_REQUIRED,
      this.AREA_REQUIRED,
      this.SHIFT_REQUIRED,
      this.SHIFT_TIME_REQUIRED,

      this.NO_NUM('EMP_NAME'),
    ].forEach((m) => this.removeErr(row, m));

    row.errors = (row.errors ?? []).filter((e) => !/IN_TIME: Invalid time format/i.test(e));
    row.errors = (row.errors ?? []).filter((e) => !/OUT_TIME: Invalid time format/i.test(e));
    row.errors = (row.errors ?? []).filter((e) => !/Max 20 characters allowed/i.test(e));
  }

  // ---------------- VALIDATIONS ----------------
  private applyLocalValidations() {
    for (const row of this.rows) {
      this.clearManagedErrors(row);

      const emp = String(row.empId ?? '').trim();
      if (!emp) this.addErr(row, this.EMP_REQUIRED);
      else if (!this.isEmpIdValid(emp)) this.addErr(row, this.EMP_INVALID);

      const dt = row.dateControl?.value;
      if (!dt) {
        if (!String(row.rawDate ?? '').trim()) this.addErr(row, this.DATE_REQUIRED);
        else this.addErr(row, this.INVALID_DATE);
      }

      const it = String(row.inTime ?? '').trim();
      if (!it) this.addErr(row, this.IN_REQUIRED);
      else if (!this.isValidHHmm(it)) this.addErr(row, `IN_TIME: ${this.INVALID_TIME}`);

      const ot = String(row.outTime ?? '').trim();
      if (!ot) this.addErr(row, this.OUT_REQUIRED);
      else if (!this.isValidHHmm(ot)) this.addErr(row, `OUT_TIME: ${this.INVALID_TIME}`);

      const arch = Number(row.isArchived);
      if (!(arch === 0 || arch === 1)) this.addErr(row, this.INVALID_ARCH);

      if (!String(row.empName ?? '').trim()) this.addErr(row, this.EMP_NAME_REQUIRED);
      if (!String(row.designation ?? '').trim()) this.addErr(row, this.DESIGNATION_REQUIRED);
      if (!String(row.division ?? '').trim()) this.addErr(row, this.DIVISION_REQUIRED);
      if (!String(row.zone ?? '').trim()) this.addErr(row, this.ZONE_REQUIRED);
      if (!String(row.branch ?? '').trim()) this.addErr(row, this.BRANCH_REQUIRED);
      if (!String(row.department ?? '').trim()) this.addErr(row, this.DEPARTMENT_REQUIRED);
      if (!String(row.function ?? '').trim()) this.addErr(row, this.FUNCTION_REQUIRED);
      if (!String(row.area ?? '').trim()) this.addErr(row, this.AREA_REQUIRED);
      if (!String(row.shift ?? '').trim()) this.addErr(row, this.SHIFT_REQUIRED);
      if (!String(row.shiftTime ?? '').trim()) this.addErr(row, this.SHIFT_TIME_REQUIRED);


      // ✅ ONLY EMP_NAME: no numbers
      this.validateNoNumber(row, row.empName, 'EMP_NAME');

      // shift time format (optional)
      if (String(row.shiftTime ?? '').trim() && !this.isValidShiftTime(String(row.shiftTime))) {
        this.addErr(row, this.SHIFT_TIME_INVALID);
      } else {
        this.removeErr(row, this.SHIFT_TIME_INVALID);
      }

      // ✅ Max length = 20 for all columns/inputs
      this.validateMaxLen(row, row.empId, 'EMP_ID');
      this.validateMaxLen(row, row.empName, 'EMP_NAME');

      this.validateMaxLen(row, row.designation, 'DESIGNATION');
      this.validateMaxLen(row, row.division, 'DIVISION');
      this.validateMaxLen(row, row.zone, 'ZONE');
      this.validateMaxLen(row, row.branch, 'BRANCH');
      this.validateMaxLen(row, row.department, 'DEPARTMENT');
      this.validateMaxLen(row, row.function, 'FUNCTION');
      this.validateMaxLen(row, row.area, 'AREA');
      this.validateMaxLen(row, row.shift, 'SHIFT');

      this.validateMaxLen(row, row.shiftTime, 'SHIFT_TIME');
      this.validateMaxLen(row, row.inTime, 'IN_TIME');
      this.validateMaxLen(row, row.outTime, 'OUT_TIME');
      this.validateMaxLen(row, String(row.isArchived ?? ''), 'IsArchived');
    }

    this.updateHasValidRow();
    this.checkDuplicateInFile();
  }

  private applyLocalValidationsSafe() {
    if (this.localValidateTimer) return;
    this.localValidateTimer = setTimeout(() => {
      this.localValidateTimer = null;
      this.applyLocalValidations();
    }, 80);
  }

  isRowValid(row: BulkAttendanceRow): boolean {
    return (row.errors?.length ?? 0) === 0 &&
      !!String(row.empId ?? '').trim() &&
      !!String(row.empName ?? '').trim() &&
      !!String(row.designation ?? '').trim() &&
      !!String(row.division ?? '').trim() &&
      !!String(row.zone ?? '').trim() &&
      !!String(row.branch ?? '').trim() &&
      !!String(row.department ?? '').trim() &&
      !!String(row.function ?? '').trim() &&
      !!String(row.area ?? '').trim() &&
      !!String(row.shift ?? '').trim() &&
      !!String(row.shiftTime ?? '').trim() &&
      !!row.dateControl?.value &&
      !!String(row.inTime ?? '').trim() &&
      !!String(row.outTime ?? '').trim() &&
      (Number(row.isArchived) === 0 || Number(row.isArchived) === 1);
  }

  updateHasValidRow() {
    for (const r of this.rows) {
      r.isValid = this.isRowValid(r);
      if (!r.isValid) r.checked = false;
    }

    this.hasValidRow = this.rows.some((r) => r.isValid === true);
    this.checkAll = this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
  }

  // ---------------- UI EVENTS ----------------
  onToggleAll(checked: boolean) {
    this.checkAll = checked;
    this.rows.forEach((r) => (r.checked = checked ? !!r.isValid : false));
    this.checkAll = this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
  }

  onRowToggle(row: BulkAttendanceRow, checked: boolean) {
    row.checked = checked && !!row.isValid;
    this.checkAll = this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
  }

  onRowDateChange(row: BulkAttendanceRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowInTimeChange(row: BulkAttendanceRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowOutTimeChange(row: BulkAttendanceRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowArchivedChange(row: BulkAttendanceRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowTextChange(row: BulkAttendanceRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  onRowShiftTimeChange(row: BulkAttendanceRow) {
    row.checked = false;
    this.applyLocalValidationsSafe();
    this.updateHasValidRow();
  }

  // ---------------- BULK PROCEED ----------------
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
        srNo: Number(r.rowNo),
        empId: String(r.empId || '').trim(),
        date: r.dateControl.value ? this.toYMD(r.dateControl.value) : null,
        inTime: String(r.inTime || '').trim(),
        outTime: String(r.outTime || '').trim(),
        isArchived: Number(r.isArchived),

        // optional
        empName: String(r.empName || '').trim() || null,
        designation: String(r.designation || '').trim() || null,
        division: String(r.division || '').trim() || null,
        zone: String(r.zone || '').trim() || null,
        branch: String(r.branch || '').trim() || null,
        department: String(r.department || '').trim() || null,
        function: String((r.function as any) || '').trim() || null,
        area: String(r.area || '').trim() || null,
        shift: String(r.shift || '').trim() || null,
        shiftTime: String(r.shiftTime || '').trim() || null,
      }))
      .filter((p) => p.empId && p.date);

    try {
      const chunks = this.chunk(payloads, 200);
      for (const ch of chunks) {
        await new Promise<void>((resolve, reject) => {
          this.attendanceService.importBulk(ch).subscribe({
            next: () => resolve(),
            error: (e) => reject(e),
          });
        });
      }

      this.toast('success', 'Success', `Imported (${selected.length}) rows`);
      this.removeRowsRef(selected);
    } catch (e: any) {
      this.toast('error', 'Error', e?.error?.message || e?.message || 'Bulk import failed');
    } finally {
      this.bulkSaving = false;
    }
  }

  // ---------------- HELPERS ----------------
  private removeRowsRef(rowsToRemove: BulkAttendanceRow[]) {
    const set = new Set(rowsToRemove);
    this.rows = this.rows.filter((r) => !set.has(r));
    this.rows.forEach((r, i) => (r.rowNo = i + 1));

    this.checkAll = this.rows.length > 0 && this.rows.every((r) => r.checked || !r.isValid);
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

    const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (m) {
      const dd = +m[1];
      const mm = +m[2];
      const yyyy = +m[3];
      const d = new Date(yyyy, mm - 1, dd);
      return isNaN(d.getTime()) ? null : d;
    }

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

  private isValidHHmm(v: string): boolean {
    const s = String(v ?? '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return false;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
  }

  private isValidShiftTime(v: string): boolean {
    // 09:00-18:00 or 09:00 - 18:00
    const s = String(v ?? '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) return false;

    const h1 = Number(m[1]), m1 = Number(m[2]);
    const h2 = Number(m[3]), m2 = Number(m[4]);

    const ok1 = h1 >= 0 && h1 <= 23 && m1 >= 0 && m1 <= 59;
    const ok2 = h2 >= 0 && h2 <= 23 && m2 >= 0 && m2 <= 59;

    return ok1 && ok2;
  }

  private hasNumber(v: any): boolean {
    return /\d/.test(String(v ?? ''));
  }

  private validateNoNumber(row: BulkAttendanceRow, value: any, label: string) {
    const msg = this.NO_NUM(label);
    if (String(value ?? '').trim() && this.hasNumber(value)) this.addErr(row, msg);
    else this.removeErr(row, msg);
  }

  private isEmpIdValid(v: any): boolean {
    const s = String(v ?? '').trim();
    if (!s) return false;

    // no spaces
    if (/\s/.test(s)) return false;

    // must contain at least one digit (so "Ali" won't pass)
    if (!/\d/.test(s)) return false;

    // allow only these chars
    return /^[A-Za-z0-9_-]+$/.test(s);
  }

  private checkDuplicateInFile() {
    const map = new Map<string, BulkAttendanceRow[]>();

    for (const row of this.rows) {
      const emp = String(row.empId ?? '').trim();
      const dt = row.dateControl?.value ? this.toYMD(row.dateControl.value) : '';

      if (!emp || !dt) continue;

      const key = `${emp}|${dt}`;
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }

    // clear old duplicate errors
    for (const row of this.rows) {
      row.errors = (row.errors ?? []).filter(e => !e.startsWith('Duplicate with row'));
    }

    // apply duplicate errors
    map.forEach((rows) => {
      if (rows.length > 1) {
        const rowNos = rows.map(r => r.rowNo).join(', ');
        rows.forEach(r => {
          this.addErr(r, `Duplicate with row(s): ${rowNos}`);
          r.checked = false;   // prevent selection
        });
      }
    });
  }

  hasErrLike(row: BulkAttendanceRow, prefix: string): boolean {
    return (row.errors ?? []).some(e => String(e).startsWith(prefix));
  }

  getErrLike(row: BulkAttendanceRow, prefix: string): string | null {
    return (row.errors ?? []).find(e => String(e).startsWith(prefix)) ?? null;
  }



  private validateMaxLen(row: BulkAttendanceRow, value: any, label: string) {
    const msg = this.TOO_LONG(label);
    const s = String(value ?? '').trim();
    if (s && s.length > this.MAX_LEN) this.addErr(row, msg);
    else this.removeErr(row, msg);
  }

  get filteredRows() {
    let list = [...this.rows];

    const term = this.searchTerm.trim().toLowerCase();

    if (term) {
      list = list.filter((row: any) => {
        const text = [
          row.rowNo,
          row.empId,
          row.empName,
          row.designation,
          row.division,
          row.zone,
          row.branch,
          row.department,
          row.function,
          row.area,
          row.shift,
          row.shiftTime,
          row.inTime,
          row.outTime,
          row.rawEmpId,
          row.rawEmpName,
          row.rawDesignation,
          row.rawDivision,
          row.rawZone,
          row.rawBranch,
          row.rawDepartment,
          row.rawFunction,
          row.rawArea,
          row.rawShift,
          row.rawShiftTime,
          row.rawDate,
          row.rawInTime,
          row.rawOutTime,
          row.rawIsArchived,
          row.isValid ? 'valid' : 'invalid',
          ...(row.errors ?? [])
        ]
          .join(' ')
          .toLowerCase();

        return text.includes(term);
      });
    }

    if (this.statusFilter === 'valid') {
      list = list.filter((r: any) => !!r.isValid);
    } else if (this.statusFilter === 'invalid') {
      list = list.filter((r: any) => !r.isValid);
    } else if (this.statusFilter === 'selected') {
      list = list.filter((r: any) => !!r.checked);
    }

    return list;
  }

  showRowErrors(row: any) {
    const errors = row.errors ?? [];
    const messages = errors.length
      ? errors.map((err: string) => `<li>${err}</li>`).join('')
      : '<li>No errors</li>';

    this.modal.info({
      nzTitle: `Row ${row.rowNo} errors`,
      nzContent: `<ul style="margin:0;padding-left:18px">${messages}</ul>`,
      nzClosable: true,
      nzWidth: 420,
    });
  }
}