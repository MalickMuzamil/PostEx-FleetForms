import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { FormsModule } from '@angular/forms';
import {
  TableConfig,
  InputRules,
} from '../../shared/form-model/data-table-model';

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule, NzTableModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table.html',
  styleUrl: './table.css',
})
export class Table implements OnChanges {
  @Input() config!: TableConfig;
  @Input() data: any[] = [];

  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();


  filteredData: any[] = [];

  globalTerm = '';
  colFilters: Record<string, any> = {};
  private branchWasCleared = false;

  constructor(private cd: ChangeDetectorRef) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.resetFilters();
      return;
    }

    if (changes['data']) this.applyFilters();
  }

  onEdit(row: any) {
    this.edit.emit(row);
  }

  onDelete(row: any) {
    if (this.isDeleteDisabled(row)) return;
    this.delete.emit(row);
  }

  resetFilters() {
    this.globalTerm = '';
    this.colFilters = {};

    for (const col of this.config?.columns ?? []) {
      if (!col.filter) continue;

      if (col.filter.type === 'select') {
        this.colFilters[col.key] = null; // ✅ IMPORTANT
      } else if (col.filter.type === 'text') {
        this.colFilters[col.key] = '';
      }
    }

    this.applyFilters();
  }

  get hasFilters(): boolean {
    return !!this.config?.columns?.some((col) => !!col.filter);
  }

  private defaultRules(r?: InputRules): Required<InputRules> {
    return {
      mode: r?.mode ?? 'any',
      maxLength: r?.maxLength ?? 9999,
      trim: r?.trim ?? true,
    };
  }

  private sanitizeInput(value: any, rules?: InputRules): string {
    const r = this.defaultRules(rules);
    let v = (value ?? '').toString();

    if (r.trim) v = v.trimStart();

    if (r.mode === 'letters') {
      v = v.replace(/[^a-zA-Z\s]/g, '');
      v = v.replace(/\s{2,}/g, ' ');
    } else if (r.mode === 'numbers') {
      v = v.replace(/[^0-9]/g, '');
    } else if (r.mode === 'alphanumeric') {
      v = v.replace(/[^a-zA-Z0-9\s-]/g, '');
      v = v.replace(/\s{2,}/g, ' ');
      v = v.replace(/-{2,}/g, '-');
    }

    if (v.length > r.maxLength) v = v.slice(0, r.maxLength);

    return v;
  }

  onGlobalTermChange(value: string) {
    // IMPORTANT: rules yahan se aayengi config se
    this.globalTerm = this.sanitizeInput(
      value,
      this.config.globalSearch?.rules,
    );
    this.applyFilters();
  }

  onColTextFilterChange(colKey: string, value: string, rules?: InputRules) {
    this.colFilters[colKey] = this.sanitizeInput(value, rules);
    this.applyFilters();
  }

  private _applyScheduled = false;
  private _applyPending = false;

  applyFilters() {
    this.syncBranchSubBranchEmployeeFilters();

    let data = [...this.data];

    if (this.globalTerm?.trim()) {
      const term = this.globalTerm.trim().toLowerCase();
      const keys = this.config.globalSearch?.keys ?? [];

      data = data.filter((row) =>
        keys.some((key) =>
          String(row[key] ?? '').toLowerCase().includes(term)
        )
      );
    }

    for (const col of this.config.columns) {
      const filter = col.filter;
      const value = this.colFilters[col.key];

      if (!filter || value == null || value === '') continue;

      if (filter.type === 'text') {
        data = data.filter((row) =>
          String(row[col.key] ?? '')
            .toLowerCase()
            .includes(String(value).toLowerCase())
        );
      }

      if (filter.type === 'select') {
        data = data.filter(
          (row) => String(row[col.key] ?? '') === String(value)
        );
      }

      if (filter.type === 'date') {
        data = data.filter((row) =>
          this.isSameDate(row[col.key], value)
        );
      }
    }

    this.filteredData = data;
    this.cd.markForCheck();
  }

  private isSameDate(rowValue: any, filterValue: string): boolean {
    if (!rowValue || !filterValue) return false;

    const rowDate = this.normalizeDate(rowValue);
    if (!rowDate) return false;

    return rowDate === filterValue;
  }

  private normalizeDate(value: any): string | null {
    if (!value) return null;

    // already yyyy-mm-dd
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const dt = value instanceof Date ? value : new Date(value);
    if (isNaN(dt.getTime())) return null;

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
  }

  onGlobalInput(ev: Event) {
    const input = ev.target as HTMLInputElement;

    const sanitized = this.sanitizeInput(
      input.value,
      this.config.globalSearch?.rules,
    );

    // model update
    this.globalTerm = sanitized;

    // IMPORTANT: DOM value update (so digits instantly disappear)
    if (input.value !== sanitized) input.value = sanitized;

    this.applyFilters();
  }

  isDeleteDisabled(row: any): boolean {
    // case 1: numeric flag (0 = inactive) — dashboard binding
    if (row?.conferenceCallFlag === 0) return true;

    // ✅ NEW: Branch General Employee Binding
    if (row?.statusFlag === 0) return true;

    // case 2: text flag ("Inactive")
    const t = (row?.conferenceCallText ?? row?.statusText ?? row?.status ?? '')
      .toString()
      .toLowerCase();

    if (t === 'inactive') return true;

    // case 3 (optional): generic boolean
    if (row?.isActive === false) return true;

    return false;
  }

  minVal(a: number, b: number): number {
    return Math.min(a, b);
  }

  onColDateFilterChange(key: string, value: string | null) {
    this.colFilters[key] = value;
    this.applyFilters();
  }

  onColSelectFilterChange(colKey: string, value: any) {
    this.colFilters[colKey] = value;

    // ✅ detect manual clear of branch
    if (colKey === 'branchName') {
      this.branchWasCleared = value == null || value === '';
    } else {
      this.branchWasCleared = false;
    }

    this.applyFilters();
  }

  private syncBranchSubBranchEmployeeFilters() {
    const branchCol = this.config?.columns?.find((c) => c.key === 'branchName');
    const subBranchCol = this.config?.columns?.find((c) => c.key === 'subBranchName');
    const employeeCol = this.config?.columns?.find((c) => c.key === 'employeeName');

    // branch + sub-branch required
    if (!branchCol?.filter || !subBranchCol?.filter) return;
    if (
      branchCol.filter.type !== 'select' ||
      subBranchCol.filter.type !== 'select'
    ) return;

    // employee optional
    const hasEmployeeFilter =
      !!employeeCol?.filter && employeeCol.filter.type === 'select';

    const rows = this.data ?? [];

    const branchToSubs = new Map<string, string[]>();
    const subToBranch = new Map<string, string>();
    const comboToEmployees = new Map<string, string[]>();
    const allEmployeesSet = new Set<string>();

    for (const row of rows) {
      const branch = String(row?.branchName ?? '').trim();
      const sub = String(row?.subBranchName ?? '').trim();
      const emp = String(row?.employeeName ?? '').trim();

      if (emp && emp !== 'NA') {
        allEmployeesSet.add(emp);
      }

      if (!branch || !sub || branch === 'NA' || sub === 'NA') continue;

      subToBranch.set(sub, branch);

      const subList = branchToSubs.get(branch) ?? [];
      if (!subList.includes(sub)) subList.push(sub);
      branchToSubs.set(branch, subList);

      if (emp && emp !== 'NA') {
        const comboKey = `${branch}__${sub}`;
        const empList = comboToEmployees.get(comboKey) ?? [];
        if (!empList.includes(emp)) empList.push(emp);
        comboToEmployees.set(comboKey, empList);
      }
    }

    for (const [, list] of branchToSubs) {
      list.sort((a, b) => a.localeCompare(b));
    }

    for (const [, list] of comboToEmployees) {
      list.sort((a, b) => a.localeCompare(b));
    }

    const allSubOptions = [...subToBranch.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((x) => ({ label: x, value: x }));

    const allEmployeeOptions = [...allEmployeesSet]
      .sort((a, b) => a.localeCompare(b))
      .map((x) => ({ label: x, value: x }));

    let selectedBranch = this.colFilters['branchName'];
    let selectedSubBranch = this.colFilters['subBranchName'];

    // ===== branch manually cleared =====
    if (this.branchWasCleared && !selectedBranch) {
      this.colFilters['subBranchName'] = null;

      if (hasEmployeeFilter) {
        this.colFilters['employeeName'] = null;
      }

      subBranchCol.filter = {
        ...subBranchCol.filter,
        options: allSubOptions,
      };

      if (hasEmployeeFilter && employeeCol?.filter) {
        employeeCol.filter = {
          ...employeeCol.filter,
          options: allEmployeeOptions,
        };
      }

      this.branchWasCleared = false;
      this.cd.markForCheck();
      return;
    }

    // ===== sub-branch selected -> optional branch auto-fill =====
    if (selectedSubBranch) {
      const parentBranch = subToBranch.get(String(selectedSubBranch));
      if (parentBranch && !selectedBranch) {
        selectedBranch = parentBranch;
        this.colFilters['branchName'] = parentBranch;
      }
    }

    // ===== branch selected -> narrow sub-branches =====
    if (selectedBranch) {
      const allowedSubs = branchToSubs.get(String(selectedBranch)) ?? [];

      subBranchCol.filter = {
        ...subBranchCol.filter,
        options: allowedSubs.map((x) => ({ label: x, value: x })),
      };

      if (selectedSubBranch) {
        const parentBranch = subToBranch.get(String(selectedSubBranch));
        if (parentBranch && parentBranch !== String(selectedBranch)) {
          this.colFilters['subBranchName'] = null;

          if (hasEmployeeFilter) {
            this.colFilters['employeeName'] = null;
          }

          selectedSubBranch = null;
        }
      }
    } else {
      subBranchCol.filter = {
        ...subBranchCol.filter,
        options: allSubOptions,
      };
    }

    // ===== employee options logic (optional) =====
    if (hasEmployeeFilter && employeeCol?.filter) {
      if (selectedBranch && selectedSubBranch) {
        const comboKey = `${selectedBranch}__${selectedSubBranch}`;
        const allowedEmployees = comboToEmployees.get(comboKey) ?? [];

        employeeCol.filter = {
          ...employeeCol.filter,
          options: allowedEmployees.map((x) => ({ label: x, value: x })),
        };

        const selectedEmployee = this.colFilters['employeeName'];
        if (
          selectedEmployee &&
          !allowedEmployees.includes(String(selectedEmployee))
        ) {
          this.colFilters['employeeName'] = null;
        }
      } else {
        employeeCol.filter = {
          ...employeeCol.filter,
          options: allEmployeeOptions,
        };
      }
    }

    this.branchWasCleared = false;
    this.cd.markForCheck();
  }
}
