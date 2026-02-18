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
    const email = String(this.form.value.email || '').trim().toLowerCase();

    try {
      // ✅ 1) Real check: does user have any passkey credentials registered?
      const hasPasskey = await this.auth.hasPasskeyRegistered(email);

      // ✅ 2) Always call initiateAuth (your startOtp) to trigger either OTP or challenge
      const result: any = await this.auth.startOtp(email);

      // ✅ 3) If user DOES NOT have passkey registered -> ALWAYS go OTP (ignore any challenge)
      if (!hasPasskey) {
        sessionStorage.setItem('auth.loginDone', '1');
        sessionStorage.removeItem('auth.otpVerified');

        this.msg.success('OTP sent to email');
        this.router.navigateByUrl('/auth/otp', { replaceUrl: true });
        return;
      }

      // ✅ 4) If user HAS passkey registered -> try passkey login ONLY if challenge is present
      if (result?.status === 'webauthn_challenge' || result?.status === 'webauthn_ready') {
        const challenge = result?.challenge;
        const rp = result?.rp;
        const credentialIds = result?.credentialIds;

        // fallback to OTP if challenge payload missing
        if (!challenge || !rp || !Array.isArray(credentialIds) || credentialIds.length === 0) {
          sessionStorage.setItem('auth.loginDone', '1');
          sessionStorage.removeItem('auth.otpVerified');

          this.msg.warning('Passkey challenge missing, using OTP.');
          this.router.navigateByUrl('/auth/otp', { replaceUrl: true });
          return;
        }

        const res: any = await this.auth.authenticateWithPasskey({ challenge, rp, credentialIds });

        const token = res?.access_token || res?.token;
        if (token) localStorage.setItem('token', token);

        sessionStorage.removeItem('auth.loginDone');
        sessionStorage.removeItem('auth.otpVerified');

        this.msg.success('Logged in with passkey');
        this.router.navigateByUrl('/', { replaceUrl: true });
        return;
      }

      // ✅ 5) If passkey registered but backend still did OTP flow -> go OTP
      sessionStorage.setItem('auth.loginDone', '1');
      sessionStorage.removeItem('auth.otpVerified');

      this.msg.success('OTP sent to email');
      this.router.navigateByUrl('/auth/otp', { replaceUrl: true });

    } catch (err: any) {
      this.msg.error(err?.message || 'Failed to login');
    } finally {
      this.loading = false;
    }
  }

}
