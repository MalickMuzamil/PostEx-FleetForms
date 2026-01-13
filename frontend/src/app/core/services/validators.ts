import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { EMAIL_REGEX, NAME_REGEX, NUMBER_REGEX } from './pattern';

export class AppValidators {
  static name(maxLength: number = 15): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;

      if (!value) return null;

      if (!NAME_REGEX.test(value)) {
        return { invalidName: true };
      }

      if (value.length > maxLength) {
        return {
          maxLength: {
            requiredLength: maxLength,
            actualLength: value.length,
          },
        };
      }

      return null;
    };
  }

  static number(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;

      if (!value) return null;

      return NUMBER_REGEX.test(value) ? null : { invalidNumber: true };
    };
  }

  static email(maxLength: number = 30): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;

      if (!value) return null;

      if (value.length > maxLength) {
        return {
          maxLength: {
            requiredLength: maxLength,
            actualLength: value.length,
          },
        };
      }

      return EMAIL_REGEX.test(value) ? null : { invalidEmail: true };
    };
  }

  static futureDate(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;

      const selectedDate = new Date(value);
      const today = new Date();

      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (selectedDate <= today) {
        return { pastDateNotAllowed: true };
      }

      return null;
    };
  }

  static alphaSpace(maxLength: number = 50): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim();
      if (!value) return null;

      // letters + digits + space + hyphen + parentheses
      if (!/^[A-Za-z0-9\- ()]+$/.test(value)) {
        return { alphaSpace: true };
      }

      if (value.length > maxLength) {
        return {
          maxLength: {
            requiredLength: maxLength,
            actualLength: value.length,
          },
        };
      }

      return null;
    };
  }
  
  static notOnlyNumbers(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim();
      if (!value) return null;

      return /^\d+$/.test(value) ? { numericOnlyNotAllowed: true } : null;
    };
  }

  static maxLen(maxLength: number = 15): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString();
      if (!value) return null;

      if (value.length > maxLength) {
        return {
          maxLength: {
            requiredLength: maxLength,
            actualLength: value.length,
          },
        };
      }

      return null;
    };
  }

  static nameShortCode3Dash2Friendly(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const v = (control.value ?? '').toString().trim();
      if (!v) return null;

      // only letters + optional single dash while typing
      if (!/^[A-Za-z-]+$/.test(v)) return { invalidName: true };
      if ((v.match(/-/g) || []).length > 1) return { invalidName: true };
      if (v.length > 6) return { invalidName: true };

      // ✅ allow partial while typing (no error)
      // Valid final forms:
      //  - ABCDE (5 letters)  -> submit pe ABC-DE ban jayega
      //  - ABC-DE (6 chars)   -> already correct
      if (v.length < 5) return null;

      // length 5: must be 5 letters (no dash)
      if (v.length === 5) {
        return /^[A-Za-z]{5}$/.test(v) ? null : { invalidName: true };
      }

      // length 6: must be 3 letters + dash + 2 letters
      return /^[A-Za-z]{3}-[A-Za-z]{2}$/.test(v) ? null : { invalidName: true };
    };
  }
}
