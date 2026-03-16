import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth-service';
import { CommonModule } from '@angular/common';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NzCardModule, NzFormModule, NzInputModule, NzButtonModule],
  selector: 'app-otp',
  templateUrl: './otp.html',
})
export class OtpComponent {
  form!: FormGroup;
  loading = false;
  resendLoading = false;
  email = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private msg: NzMessageService
  ) { }

  ngOnInit() {
    this.email = this.auth.getOtpEmail();
    this.form = this.fb.group({
      otpCode: ['', [Validators.required,
      Validators.minLength(4), Validators.maxLength(8)]],
    });
    if (!this.email) {
      this.msg.warning('Email missing, please login again');
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }

  async verify() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    try {
      const otpCode = String(this.form.value.otpCode ?? '').trim();
      const email = this.auth.getOtpEmail();
      if (!email) throw new Error('Email missing');

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
    } catch (err: any) {
      this.msg.error(err?.message || 'Failed to resend OTP');
    } finally {
      this.resendLoading = false;
    }
  }
}