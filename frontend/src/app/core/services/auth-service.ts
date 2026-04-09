import { Injectable } from '@angular/core';

// STAGE / LOCAL
import { AuthSDK, AuthSDKFetchError, setPasskeyEmail, getPasskeyEmail } from 'postex-auth-sdk-stage'

// PRODUCTION
// import { AuthSDK, AuthSDKFetchError, setPasskeyEmail, getPasskeyEmail } from 'postex-auth-sdk-live'

import { environment } from '../../../environment/environment';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private auth = new AuthSDK({
    apiKey: environment.POSTEX_PUBLIC_API_KEY,
    appId: 'callcourier'
  });

  private otpEmailKey = 'auth.otpEmail';
  private otpTokenKey = 'auth.otpToken';
  private passkeyEnabledKey = 'auth.passkeyEnabled';
  private postexAccessKey = 'postex.access_token';
  private postexRefreshKey = 'postex.refresh_token';
  private postexUserKey = 'postex.user';

  private authed$ = new BehaviorSubject<boolean>(false);
  private endpoint = '/auth';

  constructor(private api: GeneralService, private router: Router) {

    // 🔧 override SDK base URL
    // (this.auth as any).getBaseUrl = () => `${environment.POSTEX_BASE_URL}/public/v1`;

  }

  // 🔐 SAVE PASSKEY EMAIL (stage + prod both)
  async savePasskeyEmail(email: string) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return;

    try {
      await setPasskeyEmail(normalized);
      localStorage.setItem('auth.email', normalized);
    } catch (err) {
      console.error('Failed to save passkey email', err);
    }
  }

  // 🔐 GET SAVED PASSKEY EMAIL
  async getSavedPasskeyEmail(): Promise<string | null> {
    try {
      const sdkEmail = await getPasskeyEmail();
      const fallback = localStorage.getItem('auth.email');
      return sdkEmail || fallback;
    } catch {
      return localStorage.getItem('auth.email');
    }
  }

  async startOtp(email: string) {
    email = String(email || '').trim().toLowerCase();
    if (!email) throw new Error('Email required');

    const status: any = await this.auth.getStatus({ email });

    const notFound =
      status?.status === 'not_found' ||
      status?.status === 'user_not_found' ||
      status?.exists === false ||
      status?.found === false;

    if (notFound) throw new Error('User not found');

    const result: any = await this.auth.initiateAuth({ email });

    localStorage.setItem(this.otpEmailKey, email);

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

      const resp = await (this.auth as any).verifyOTP(otp);

      this.storePostexSession(resp);

      return resp;

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

    return this.auth.resendOTP();

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

    localStorage.removeItem('postex-auth-token');
    localStorage.removeItem('postex.access_token');
    localStorage.removeItem('postex.refresh_token');
    localStorage.removeItem('postex.user');
    localStorage.removeItem('UserData');

    sessionStorage.removeItem('auth.loginDone');
    sessionStorage.removeItem('auth.otpVerified');

    this.router.navigateByUrl('/auth/login', { replaceUrl: true });

    this.setAuthenticated(false);

  }

  hasToken(): boolean {
    return !!localStorage.getItem('postex-auth-token') || !!localStorage.getItem('postex.access_token');
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload?.exp;
      if (!exp) return true;
      return exp <= Math.floor(Date.now() / 1000);
    } catch {
      return true;
    }
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

    await this.savePasskeyEmail(email);

    return await this.auth.registerPasskey(email);

  }

  setPasskeyEnabled(val: boolean) {
    localStorage.setItem(this.passkeyEnabledKey, val ? '1' : '0');
  }

  isPasskeyEnabled(): boolean {
    return localStorage.getItem(this.passkeyEnabledKey) === '1';
  }

  async hasPasskeyRegistered(email: string): Promise<boolean> {

    const normalized = String(email || '').trim().toLowerCase();
    const status: any = await this.auth.getStatus({ email: normalized });

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

  storePostexSession(resp: any) {

    const data = resp?.data ?? resp;

    const access = data?.access_token;
    const refresh = data?.refresh_token;

    if (access) localStorage.setItem(this.postexAccessKey, access);
    if (access) localStorage.setItem('postex-auth-token', access);
    if (refresh) localStorage.setItem(this.postexRefreshKey, refresh);

    const user = {
      email: data?.email,
      name: data?.name,
      userName: data?.userName,
      realm: data?.realm,
      roles: data?.roles || [],
      apps: data?.apps || [],
      auth_method: data?.auth_method,
    };

    localStorage.setItem(this.postexUserKey, JSON.stringify(user));

  }

  getPostexAccessToken() {
    return localStorage.getItem(this.postexAccessKey);
  }

  getPostexUser(): any {
    try {
      const raw = localStorage.getItem(this.postexUserKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  getUserRoles(): string[] {
    const user = this.getPostexUser();
    const roles = user?.roles || [];
    if (!Array.isArray(roles)) return [];

    return roles
      .map((r: any) => String(r || '').trim().toLowerCase())
      .map((r: string) => {
        if (r === 'postex-auth-admin') return 'ADMIN';
        if (r === 'postex-auth-cs') return 'CS';
        if (r === 'postex-auth-hr') return 'HR';
        if (r === 'postex-auth-it') return 'IT';
        if (r === 'postex' || r === 'user') return 'USER';
        if (r === 'admin') return 'ADMIN';
        if (r === 'cs') return 'CS';
        if (r === 'hr') return 'HR';
        if (r === 'it') return 'IT';
        return r.toUpperCase();
      });
  }

  hasRole(role: string): boolean {
    if (!role) return false;
    const normalized = String(role).trim().toUpperCase();
    const roles = this.getUserRoles();
    return roles.includes(normalized);
  }

  verifyTokenFromBackend() {
    return this.api.get('/auth/verify-token').toPromise();
  }


}