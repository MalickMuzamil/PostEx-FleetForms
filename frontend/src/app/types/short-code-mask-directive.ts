import { Directive, HostListener, Optional } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: '[appShortCodeMask]',
  standalone: true,
})
export class ShortCodeMaskDirective {
  constructor(@Optional() private ngControl: NgControl) {}

  @HostListener('input', ['$event'])
  onInput(e: Event) {
    const input = e.target as HTMLInputElement;

    let v = (input.value ?? '').toUpperCase();

    v = v.replace(/[^A-Z]/g, '');

    v = v.slice(0, 5);

    if (v.length > 3) {
      v = `${v.slice(0, 3)}-${v.slice(3, 5)}`;
    }

    v = v.slice(0, 6);

    if (input.value !== v) input.value = v;

    if (this.ngControl?.control) {
      this.ngControl.control.setValue(v, { emitEvent: false });
      this.ngControl.control.markAsDirty();
    }
  }
}
