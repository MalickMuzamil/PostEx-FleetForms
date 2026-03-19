import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth-service';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';

@Component({
  standalone: true,
  selector: 'app-otp',
  imports: [CommonModule, ReactiveFormsModule, NzButtonModule],
  templateUrl: './otp.html',
  styleUrls: ['./otp.css']
})
export class OtpComponent {
  form!: FormGroup;
  loading = false;
  resendLoading = false;
  email = '';

  otpArray = Array(6).fill(0);
  otpValues: string[] = ['', '', '', '', '', ''];
  activeIndex = 0;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private msg: NzMessageService
  ) {}

  ngOnInit() {
    this.email = this.auth.getOtpEmail();

    this.form = this.fb.group({
      otpCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    });

    if (!this.email) {
      this.msg.warning('Email missing, please login again');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      return;
    }
  }

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');

    if (!value) {
      this.otpValues[index] = '';
      this.updateOtpValue();
      return;
    }

    value = value.charAt(value.length - 1);
    this.otpValues[index] = value;
    this.updateOtpValue();

    if (index < this.otpArray.length - 1) {
      const nextInput = document.querySelectorAll<HTMLInputElement>('.otp-box')[index + 1];
      nextInput?.focus();
      this.activeIndex = index + 1;
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    const key = event.key;

    if (key === 'Backspace') {
      if (this.otpValues[index]) {
        this.otpValues[index] = '';
        this.updateOtpValue();
        return;
      }

      if (index > 0) {
        const prevInput = document.querySelectorAll<HTMLInputElement>('.otp-box')[index - 1];
        this.otpValues[index - 1] = '';
        this.updateOtpValue();
        prevInput?.focus();
        this.activeIndex = index - 1;
      }
      return;
    }

    if (key === 'ArrowLeft' && index > 0) {
      const prevInput = document.querySelectorAll<HTMLInputElement>('.otp-box')[index - 1];
      prevInput?.focus();
      this.activeIndex = index - 1;
      return;
    }

    if (key === 'ArrowRight' && index < this.otpArray.length - 1) {
      const nextInput = document.querySelectorAll<HTMLInputElement>('.otp-box')[index + 1];
      nextInput?.focus();
      this.activeIndex = index + 1;
      return;
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();

    const pastedData = event.clipboardData?.getData('text') ?? '';
    const digits = pastedData.replace(/\D/g, '').slice(0, this.otpArray.length).split('');

    if (!digits.length) return;

    this.otpValues = this.otpValues.map((_, i) => digits[i] ?? '');
    this.updateOtpValue();

    const nextIndex = Math.min(digits.length, this.otpArray.length - 1);
    const inputs = document.querySelectorAll<HTMLInputElement>('.otp-box');
    inputs[nextIndex]?.focus();
    this.activeIndex = nextIndex;
  }

  updateOtpValue(): void {
    const code = this.otpValues.join('');
    this.form.patchValue({ otpCode: code }, { emitEvent: false });
  }

  isOtpComplete(): boolean {
    return this.otpValues.every(value => value !== '');
  }

  async verify() {
    if (this.form.invalid || !this.isOtpComplete()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    try {
      const otpCode = String(this.form.value.otpCode ?? '').trim();
      const email = this.auth.getOtpEmail();

      if (!email) {
        throw new Error('Email missing');
      }

      await this.auth.verifyOtp(otpCode);
      await this.auth.savePasskeyEmail(email);

      this.auth.setAuthenticated(true);
      this.auth.setOtpVerified();

      this.msg.success('OTP verified');
      this.router.navigateByUrl('/auth/passkey', { replaceUrl: true });

    } catch (err: any) {
      this.msg.error(err?.message || 'OTP verification failed');
    } finally {
      this.loading = false;
    }
  }

  async resend() {
    this.resendLoading = true;

    try {
      await this.auth.resendOtp();
      this.msg.success('OTP resent');

      // optional: reset OTP boxes on resend
      this.otpValues = ['', '', '', ''];
      this.updateOtpValue();
      this.activeIndex = 0;

      setTimeout(() => {
        const firstInput = document.querySelector<HTMLInputElement>('.otp-box');
        firstInput?.focus();
      });

    } catch (err: any) {
      this.msg.error(err?.message || 'Failed to resend OTP');
    } finally {
      this.resendLoading = false;
    }
  }
}