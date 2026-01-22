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

  constructor(private cd: ChangeDetectorRef) {}

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
    // coalesce rapid calls (debounce-like)
    if (this._applyScheduled) {
      this._applyPending = true;
      return;
    }

    this._applyScheduled = true;
    setTimeout(() => {
      const rows = this.data ?? [];

      const LARGE_THRESHOLD = 2000;
      const runFilter = () => {
        const searchKeys = this.config?.globalSearch?.keys?.length
          ? this.config.globalSearch.keys
          : (this.config?.columns ?? []).map((c) => c.key);

        const term = (this.globalTerm || '').trim().toLowerCase();

        this.filteredData = rows.filter((row) => {
          if (term) {
            const match = searchKeys.some((k) =>
              String(row?.[k] ?? '')
                .toLowerCase()
                .includes(term),
            );
            if (!match) return false;
          }

          for (const col of this.config?.columns ?? []) {
            const f = col.filter;
            if (!f) continue;

            if (f.predicate) {
              const val = this.colFilters[col.key];
              if (val != null && val !== '' && !f.predicate(row, val))
                return false;
              continue;
            }

            if (f.type === 'text') {
              const v = (this.colFilters[col.key] ?? '')
                .toString()
                .trim()
                .toLowerCase();
              if (
                v &&
                !String(row?.[col.key] ?? '')
                  .toLowerCase()
                  .includes(v)
              )
                return false;
            }

            if (f.type === 'select') {
              const v = this.colFilters[col.key];
              if (
                v !== undefined &&
                v !== null &&
                v !== '' &&
                row?.[col.key] !== v
              )
                return false;
            }
          }

          return true;
        });

        // inform Angular (OnPush) that view changed
        try {
          this.cd.markForCheck();
        } catch (e) {
          // noop
        }
      };

      if (rows.length > LARGE_THRESHOLD) {
        // large dataset: avoid blocking immediate UI by scheduling filtering
        console.warn(
          'Table: large dataset detected, running filter in a scheduled task',
          rows.length,
        );
        setTimeout(runFilter, 0);
      } else {
        runFilter();
      }

      this._applyScheduled = false;
      if (this._applyPending) {
        this._applyPending = false;
        this.applyFilters();
      }
    }, 150);
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
}
