import { Injectable } from '@angular/core';
import { AuthSDK, AuthSDKFetchError } from 'postex-auth-sdk-stage';
import { environment } from '../../../environment/environment';
import { BehaviorSubject, tap } from 'rxjs';
import { Router } from '@angular/router';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = new AuthSDK({ apiKey: environment.POSTEX_PUBLIC_API_KEY });

  private otpEmailKey = 'auth.otpEmail';
  private otpTokenKey = 'auth.otpToken';
  private passkeyEnabledKey = 'auth.passkeyEnabled';

  private authed$ = new BehaviorSubject<boolean>(false);
  private endpoint = '/auth';

  constructor(private api: GeneralService, private router: Router) { }

  async startOtp(email: string) {
    email = String(email || '').trim().toLowerCase();
    if (!email) throw new Error('Email required');

    const status: any = await this.auth.getStatus(email);
    const notFound =
      status?.status === 'not_found' ||
      status?.status === 'user_not_found' ||
      status?.exists === false ||
      status?.found === false;

    if (notFound) throw new Error('User not found');

    const result: any = await this.auth.initiateAuth(email);

    localStorage.setItem(this.otpEmailKey, email);

    // token optional - store only if exists (even if you don't want to send it)
    const token =
      result?.token ??
      result?.data?.token ??
      result?.data?.data?.token ??
      result?.authToken ??
      result?.sessionToken ??
      result?.session?.token ??
      result?.data?.sessionToken ??
      result?.data?.authToken ??
      result?.data?.session?.token ??
      null;

    if (token) localStorage.setItem(this.otpTokenKey, token);

    return result;
  }

  async verifyOtp(otpCode: any) {
    const otp = String(otpCode ?? '').replace(/\D/g, '').trim();

    if (!/^\d{6}$/.test(otp)) {
      throw new Error('OTP must be exactly 6 digits');
    }

    const email = String(localStorage.getItem(this.otpEmailKey) || '').trim().toLowerCase();
    if (!email) throw new Error('Email missing, please initiate OTP again');

    try {
      return await (this.auth as any).verifyOTP(otp);
    } catch (e: any) {
      if (e instanceof AuthSDKFetchError) {
        throw new Error(e?.response?.data?.message || 'OTP verification failed');
      }
      throw e;
    }
  }

  async resendOtp() {
    const email = localStorage.getItem(this.otpEmailKey) || '';
    if (!email) throw new Error('Email missing, go back to login');
    return this.startOtp(email);
  }

  getOtpEmail() {
    return localStorage.getItem(this.otpEmailKey) || '';
  }

  clearOtpSession() {
    localStorage.removeItem(this.otpEmailKey);
    localStorage.removeItem(this.otpTokenKey);
  }

  isAuthenticatedSync() {
    return this.authed$.value;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('UserData');

    sessionStorage.removeItem('auth.loginDone');
    sessionStorage.removeItem('auth.otpVerified');

    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    this.setAuthenticated(false);
  }

  hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  verifyToken() {
    return this.api.get('/auth/verify').pipe(
      tap(() => {
        console.log('Token verified');
        this.setAuthenticated(true);
      })
    );
  }

  setAuthenticated(val: boolean) {
    this.authed$.next(val);
  }

  setOtpVerified() {
    sessionStorage.setItem('auth.otpVerified', '1');
  }

  isOtpVerified(): boolean {
    return sessionStorage.getItem('auth.otpVerified') === '1';
  }

  async authenticateWithPasskey(params: {
    challenge: string;
    rp: { name: string; host: string };
    credentialIds: string[];
  }) {
    return await (this.auth as any).authenticateWithPasskey(params);
  }

  async registerPasskey(email: string) {
    return await this.auth.registerPasskey(email);
  }

  setPasskeyEnabled(val: boolean) {
    localStorage.setItem(this.passkeyEnabledKey, val ? '1' : '0');
  }

  isPasskeyEnabled(): boolean {
    return localStorage.getItem(this.passkeyEnabledKey) === '1';
  }

  async hasPasskeyRegistered(email: string): Promise<boolean> {
    const status: any = await this.auth.getStatus(String(email || '').trim().toLowerCase());

    // ✅ ONLY consider "registered" if credentials actually exist
    const credentialIds =
      status?.credentialIds ??
      status?.webauthn?.credentialIds ??
      status?.passkey?.credentialIds ??
      status?.data?.credentialIds ??
      status?.data?.webauthn?.credentialIds ??
      status?.credentials ??
      status?.webauthn?.credentials ??
      status?.passkeys ??
      [];

    return Array.isArray(credentialIds) && credentialIds.length > 0;
  }

  issueJwtAfterOtp(email: string, otpCode: string) {
    return this.api.post('/auth/verify-otp', {
      email,
      otpCode
    });
  }
}
