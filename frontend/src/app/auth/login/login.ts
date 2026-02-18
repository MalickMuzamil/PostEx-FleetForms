import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth-service';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [NzCardModule, NzFormModule, NzInputModule, NzButtonModule, ReactiveFormsModule, CommonModule],
  selector: 'app-login',
  templateUrl: './login.html',
})
export class LoginComponent {
  form!: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private msg: NzMessageService
  ) { }

  ngOnInit(): void {
    this.form = this.fb.group({
      email: this.fb.control('', {
        validators: [Validators.required, Validators.email, Validators.maxLength(80)],
        updateOn: 'blur',
      }),
    });
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const email = this.form.value.email;

    try {
      const result: any = await this.auth.startOtp(email);

      if (result?.status === 'otp_sent') {
        this.msg.success('OTP sent to email');
        this.router.navigateByUrl('/auth/otp', { replaceUrl: true });
      } else if (result?.status === 'webauthn_challenge') {
        this.msg.info('Passkey required (webauthn)');
        // agar passkey flow implement karna ho to yahan handle karo
      } else {
        this.msg.success('Auth initiated');
        this.router.navigateByUrl('/auth/otp', { replaceUrl: true });
      }
    } catch (err: any) {
      this.msg.error(err?.message || 'Failed to send OTP');
    } finally {
      this.loading = false;
    }
  }
}
