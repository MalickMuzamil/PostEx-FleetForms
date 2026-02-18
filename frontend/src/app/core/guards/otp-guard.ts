import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class OtpGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean | UrlTree {

    const loginDone = sessionStorage.getItem('auth.loginDone') === '1';
    const otpVerified = sessionStorage.getItem('auth.otpVerified') === '1';

    if (!loginDone) {
      return this.router.createUrlTree(['/auth/login']);
    }
    
    if (otpVerified) {
      return this.router.createUrlTree(['/auth/passkey']);
    }

    return true;
  }
}
