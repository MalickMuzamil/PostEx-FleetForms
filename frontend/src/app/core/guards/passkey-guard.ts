import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class PasskeyGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean {
    const loginDone = sessionStorage.getItem('auth.loginDone') === '1';
    const otpVerified = sessionStorage.getItem('auth.otpVerified') === '1';

    if (!loginDone) {
      this.router.navigate(['/auth/login'], { replaceUrl: true });
      return false;
    }

    if (!otpVerified) {
      this.router.navigate(['/auth/otp'], { replaceUrl: true });
      return false;
    }

    sessionStorage.removeItem('auth.otpVerified');
    return true;
  }
}
