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
  styleUrl: './login.css'
})
export class LoginComponent {
  form!: FormGroup;
  loading = false;
  savedEmail: string | null = null;
  passkeyAvailable = false;

  /** Reused with same email so AuthService.startOtp can skip a duplicate getStatus call. */
  private cachedAuthStatus: any = null;
  private cachedStatusEmail: string | null = null;

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
      }),
    });

    this.loadSavedEmail();
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const email = String(this.form.value.email || '').trim().toLowerCase();

    localStorage.setItem('auth.email', email);

    try {
      const snapshot =
        this.cachedStatusEmail !== null && email === this.cachedStatusEmail
          ? this.cachedAuthStatus
          : undefined;

      const result: any = await this.auth.startOtp(email, { statusSnapshot: snapshot });

      if (result?.status === 'webauthn_challenge' || result?.status === 'webauthn_ready') {
        const challenge = result?.challenge;
        const rp = result?.rp;
        const credentialIds = result?.credentialIds;

        if (!challenge || !rp || !Array.isArray(credentialIds) || credentialIds.length === 0) {
          sessionStorage.setItem('auth.loginDone', '1');
          sessionStorage.removeItem('auth.otpVerified');

          this.msg.warning('Passkey challenge missing, using OTP.');
          this.router.navigateByUrl('/auth/otp', { replaceUrl: true });
          return;
        }

        const res: any = await this.auth.authenticateWithPasskey({ challenge, rp, credentialIds });
        this.auth.storePostexSession(res);

        sessionStorage.removeItem('auth.loginDone');
        sessionStorage.removeItem('auth.otpVerified');

        this.msg.success('Logged in with passkey');
        this.router.navigateByUrl('/', { replaceUrl: true });
        return;
      }

      sessionStorage.setItem('auth.loginDone', '1');
      sessionStorage.removeItem('auth.otpVerified');

      this.msg.success('OTP sent to email');
      this.router.navigateByUrl('/auth/otp', { replaceUrl: true });

    } catch (err: any) {
      const message =
        err?.error?.error?.message ||
        err?.error?.message ||
        err?.error?.statusText ||
        'Failed to login';

      this.msg.error(message);

    } finally {
      this.loading = false;
    }
  }

  async loadSavedEmail() {

    try {

      const email = await this.auth.getSavedPasskeyEmail();

      console.log('[Login] SDK email:', email);

      if (!email) {
        console.log('[Login] No saved email found');
        return;
      }

      this.savedEmail = email;

      this.form.patchValue({ email });

       console.log('[Login] Email patched in form:', email);

      const status = await this.auth.getAuthStatus(email);
      this.cachedAuthStatus = status;
      this.cachedStatusEmail = String(email).trim().toLowerCase();
      this.passkeyAvailable = this.auth.hasPasskeyFromStatus(status);

    } catch (err) {

      console.error(err);

    }

  }

  async continueWithPasskey() {

    if (!this.savedEmail) return;

    try {

      const email = String(this.savedEmail || '').trim().toLowerCase();
      localStorage.setItem('auth.email', email);

      const snapshot =
        this.cachedStatusEmail !== null && email === this.cachedStatusEmail
          ? this.cachedAuthStatus
          : undefined;

      const result: any = await this.auth.startOtp(email, { statusSnapshot: snapshot });

      if (result?.status !== 'webauthn_challenge') return;

      const res: any = await this.auth.authenticateWithPasskey({
        challenge: result.challenge,
        rp: result.rp,
        credentialIds: result.credentialIds
      });
      this.auth.storePostexSession(res);

      this.router.navigateByUrl('/');

    } catch (err) {
      console.error(err);
    }

  }

}