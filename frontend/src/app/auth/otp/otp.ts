import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';

@Component({
  selector: 'app-otp',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule
  ],
  templateUrl: './otp.html',
  styleUrl: './otp.css',
})
export class OTP {
  form!: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private msg: NzMessageService
  ) { }

  ngOnInit() {
    this.form = this.fb.group({
      otp: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(8)]],
    });
  }

  get otpCtrl() {
    return this.form.get('otp');
  }

  verifyOtp() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.msg.error('Enter valid OTP');
      return;
    }

    this.loading = true;

    const otpValue = this.form.value.otp;
    setTimeout(() => {

      sessionStorage.setItem('auth.otpVerified', '1');

      this.msg.success('OTP verified successfully');

      this.loading = false;

      this.router.navigateByUrl('/auth/passkey', { replaceUrl: true });

    }, 600);
  }

  resend() {
    this.msg.success('OTP resent successfully');
  }
}
