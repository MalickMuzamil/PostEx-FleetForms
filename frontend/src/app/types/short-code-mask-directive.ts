import { Directive, HostListener, Optional, Input } from '@angular/core';
import { NgControl } from '@angular/forms';

export type ShortCodeMaskType =
  | 'SHORT_CODE_3_2'
  | 'ALPHA5_ROMAN'
  | 'AAA_AAA'
  | 'AAA_AAA_AAA';

@Directive({
  selector: '[appShortCodeMask]',
  standalone: true,
})
export class ShortCodeMaskDirective {
  @Input('appShortCodeMask') mask: ShortCodeMaskType = 'SHORT_CODE_3_2';
  @Input() prefix: string = '';

  constructor(@Optional() private ngControl: NgControl) {}

  @HostListener('input', ['$event'])
  onInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const raw = (input.value ?? '').toUpperCase();

    const v =
      this.mask === 'ALPHA5_ROMAN'
        ? this.applyAlpha5Roman(raw)
        : this.mask === 'AAA_AAA_AAA'
          ? this.apply3Dash3Dash3WithPrefixLock(raw, this.prefix)
          : this.mask === 'AAA_AAA'
            ? this.apply3Dash3(raw)
            : this.apply3Dash2(raw);

    if (input.value !== v) {
      input.value = v;
    }

    if (this.ngControl?.control) {
      this.ngControl.control.setValue(v, { emitEvent: false });
      this.ngControl.control.markAsDirty();
    }
  }

  private apply3Dash2(raw: string): string {
    let v = raw.replace(/[^A-Z]/g, '').slice(0, 5); // max 5 letters
    if (v.length > 3) {
      v = `${v.slice(0, 3)}-${v.slice(3, 5)}`;
    }
    return v.slice(0, 6);
  }

  private applyAlpha5Roman(raw: string): string {
    let v = raw.replace(/[^A-Z-]/g, '');

    const dashIndex = v.indexOf('-');
    if (dashIndex !== -1) {
      v = v.slice(0, dashIndex + 1) + v.slice(dashIndex + 1).replace(/-/g, '');
    }

    const parts = v.split('-', 2);

    const left = (parts[0] ?? '').replace(/[^A-Z]/g, '').slice(0, 5);

    let right = (parts[1] ?? '').replace(/[^IVX]/g, '').slice(0, 4);

    const allowedRomans = [
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
      'X',
    ];

    if (right && !allowedRomans.some((r) => r.startsWith(right))) {
      right = right.slice(0, -1);
    }

    if (dashIndex === -1) return left;

    if (!right) return `${left}-`;

    return `${left}-${right}`.slice(0, 10); // AAAAA-VIII = 10 chars
  }

  private apply3Dash3(raw: string): string {
    let v = raw.replace(/[^A-Z]/g, '').slice(0, 6);
    if (v.length > 3) v = `${v.slice(0, 3)}-${v.slice(3, 6)}`;
    return v.slice(0, 7);
  }

  private apply3Dash3Dash3WithPrefixLock(raw: string, prefix: string): string {
    const upper = (raw ?? '').toUpperCase();

    // prefix like "FSD" / "LHE"
    const p = (prefix ?? '').toUpperCase().replace(/[^A-Z]/g, '');

    // only letters/dashes while typing
    const cleaned = upper.replace(/[^A-Z-]/g, '');

    // if prefix exists => force "PREFIX-" and format only AFTER it
    if (p) {
      // remove any user-typed prefix junk; only take letters after first dash
      const firstDash = cleaned.indexOf('-');
      const after = firstDash >= 0 ? cleaned.slice(firstDash + 1) : cleaned;

      const letters = after.replace(/[^A-Z]/g, '').slice(0, 9);
      const a = letters.slice(0, 3);
      const b = letters.slice(3, 6);
      const c = letters.slice(6, 9);

      if (letters.length === 0) return `${p}-`;
      if (letters.length <= 3) return `${p}-${a}`;
      if (letters.length <= 6) return `${p}-${a}-${b}`;
      return `${p}-${a}-${b}-${c}`;
    }

    // no prefix => normal AAA-AAA-AAA
    const letters = cleaned.replace(/[^A-Z]/g, '').slice(0, 9);
    const a = letters.slice(0, 3);
    const b = letters.slice(3, 6);
    const c = letters.slice(6, 9);

    if (letters.length <= 3) return a;
    if (letters.length <= 6) return `${a}-${b}`;
    return `${a}-${b}-${c}`;
  }
}
