import { Injectable } from '@angular/core';
import { AuthSDK, AuthSDKFetchError } from 'postex-auth-sdk-stage';
import { environment } from '../../../environment/environment';
import { BehaviorSubject, tap, catchError, of, map, Observable } from 'rxjs';
import { Router } from '@angular/router';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = new AuthSDK({
    apiKey: environment.POSTEX_PUBLIC_API_KEY
  });

  private otpEmailKey = 'auth.otpEmail';
  private otpTokenKey = 'auth.otpToken';
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

    const result = await this.auth.initiateAuth(email);

    localStorage.setItem(this.otpEmailKey, email);

    const r: any = result;
    const token =
      r?.token ||
      r?.data?.token ||
      r?.authToken ||
      r?.sessionToken ||
      null;

    if (token) localStorage.setItem(this.otpTokenKey, token);

    return result;
  }

  async verifyOtp(otpCode: string) {
    otpCode = String(otpCode || '').trim();
    if (!otpCode) throw new Error('OTP required');

    try {
      return await (this.auth as any).verifyOTP(otpCode);
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
}
