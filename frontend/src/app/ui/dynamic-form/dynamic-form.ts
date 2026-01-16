import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  NgZone,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormGroup,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  FormConfig,
  FormField,
} from '../../shared/form-model/dynamic-form-model';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { Subscription } from 'rxjs';
import { ShortCodeMaskDirective } from '../../types/short-code-mask-directive';

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzCardModule,
    NzDatePickerModule,
    NzSelectModule,
    NzInputModule,
    NzButtonModule,
    NzFormModule,
    NzCheckboxModule,
    NzSpinModule,
    NzProgressModule,
    ShortCodeMaskDirective,
  ],
  templateUrl: './dynamic-form.html',
  styleUrl: './dynamic-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicForm implements OnInit, OnChanges, OnDestroy {
  @Input() config!: FormConfig;
  @Input() data: any = {};

  @Output() submitForm = new EventEmitter<any>();
  @Output() formChange = new EventEmitter<{
    key: string;
    value: any;
    formValue: any;
  }>();

  form!: FormGroup;
  private valueSub?: Subscription;

  selectSearchMap: Record<string, string> = {};
  uploadProgressMap: Record<string, number> = {};
  uploadingMap: Record<string, boolean> = {};

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.createForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config']) {
      this.createForm();
      this.cdr.markForCheck();
    }

    if (changes['data'] && this.form) {
      const src = this.data || {};
      const patch: any = {};

      let focusedControl: string | null = null;
      try {
        const active = document?.activeElement as HTMLElement | null;
        focusedControl = active?.closest
          ? (
              active.closest('[formcontrolname]') as HTMLElement | null
            )?.getAttribute('formcontrolname') ?? null
          : active?.getAttribute('formcontrolname') ?? null;
      } catch {
        focusedControl = null;
      }

      for (const k of Object.keys(src)) {
        const field = this.config?.fields?.find((f) => f.key === k);
        const willUpdateOnBlur = field?.updateOn === 'blur';

        if (k === focusedControl) continue;
        if (willUpdateOnBlur) continue;

        patch[k] = src[k];
      }

      if (Object.keys(patch).length) {
        this.form.patchValue(patch, { emitEvent: false });
        this.cdr.markForCheck();
      }
    }
  }

  ngOnDestroy() {
    this.valueSub?.unsubscribe();
  }

  createForm() {
    this.valueSub?.unsubscribe();

    const group: any = {};

    (this.config?.fields || []).forEach((field) => {
      let value = this.data?.[field.key] ?? null;

      if (
        (value === null || value === undefined) &&
        field.defaultValue !== undefined
      ) {
        value = field.defaultValue;
      }

      if (field.type === 'date' && value) {
        value = value instanceof Date ? value : new Date(value);
      }

      const disabled = !!field.disabled || field.type === 'readonly';

      group[field.key] = new FormControl({ value, disabled }, {
        validators: [
          ...(field.required ? [Validators.required] : []),
          ...(field.validators || []),
        ],
        updateOn: field.updateOn ?? 'change',
      } as any);
    });

    this.form = new FormGroup(group);

    queueMicrotask(() => {
      this.form.updateValueAndValidity({ emitEvent: false });
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
    });

    // It's my mistake
    // const sb = this.form.get('subBranchId');
    // if (sb) {
    //   this.valueSub = sb.valueChanges.subscribe((val) => {
    //     this.formChange.emit({
    //       key: 'subBranchId',
    //       value: val,
    //       formValue: this.form.getRawValue(),
    //     });
    //   });
    // } else {
    //   this.valueSub = undefined;
    // }

    this.valueSub = this.form.valueChanges.subscribe(() => {
      this.formChange.emit({
        key: '__form__',
        value: null,
        formValue: this.form.getRawValue(),
      });
    });

    // OnPush refresh
    this.cdr.markForCheck();
  }

  onSelectChange(key: string, value: any) {
    this.formChange.emit({ key, value, formValue: this.form.getRawValue() });
  }

  filterOption = (input: string, option: any): boolean => {
    const val = (input || '').toLowerCase().trim();

    const label = (option?.nzLabel ?? '').toString().toLowerCase();
    if (label === '__header__') return false;

    const title = (option?.nzTitle ?? '').toString().toLowerCase();
    return label.includes(val) || title.includes(val);
  };

  submit() {
    if (this.form.valid) {
      this.submitForm.emit(this.form.getRawValue());
    } else {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
    }
  }

  hasError(fieldKey: string, error: string) {
    const c = this.form.get(fieldKey);
    return !!c && (c.dirty || c.touched) && c.hasError(error);
  }

  getDisabledDateFn(fieldKey: string): ((d: Date) => boolean) | undefined {
    if (fieldKey !== 'effectiveDate') return undefined;

    return (d: Date): boolean => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const date = new Date(d);
      date.setHours(0, 0, 0, 0);

      return date <= today;
    };
  }

  onSelectSearch(fieldKey: string, value: string) {
    if (!value) {
      this.selectSearchMap[fieldKey] = '';
      return;
    }

    let sanitized = value;

    const MAX_LENGTH = 15;
    sanitized = sanitized.slice(0, MAX_LENGTH);

    sanitized = sanitized.replace(/[^A-Za-z0-9 ]/g, '');
    sanitized = sanitized.replace(/\s+/g, ' ').trimStart();

    this.selectSearchMap[fieldKey] = sanitized;

    // ✅ OnPush: update search UI if you show it anywhere
    this.cdr.markForCheck();
  }

  isFileDisabled(field: FormField): boolean {
    if (field.disabled) return true;

    if (field.disabledWhen?.length) {
      const shouldDisable = field.disabledWhen.some(
        (key) => !!this.form.get(key)?.value
      );
      if (shouldDisable) return true;
    }

    if (field.enabledWhen?.length) {
      const isEnabled = field.enabledWhen.every(
        (key) => !!this.form.get(key)?.value
      );
      if (!isEnabled) return true;
    }

    return false;
  }

  onFileSelected(fieldKey: string, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    input.value = '';

    this.uploadingMap[fieldKey] = true;
    this.uploadProgressMap[fieldKey] = 0;
    this.cdr.markForCheck();

    const interval = setInterval(() => {
      this.zone.run(() => {
        if (this.uploadProgressMap[fieldKey] >= 100) {
          clearInterval(interval);

          this.uploadingMap[fieldKey] = false;
          this.form.get(fieldKey)?.setValue(file);

          this.formChange.emit({
            key: fieldKey,
            value: file,
            formValue: this.form.getRawValue(),
          });

          this.cdr.markForCheck();
          return;
        }

        this.uploadProgressMap[fieldKey] += 10;
        this.cdr.markForCheck();
      });
    }, 150);
  }

  getGridTemplate(cols: any[] = []): string {
    if (!cols.length) return '1fr';
    return cols.map((c) => (c.width ? c.width : '1fr')).join(' ');
  }
}
