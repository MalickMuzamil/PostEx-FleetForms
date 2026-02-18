import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

function isTokenExpired(token: string): boolean {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const exp = payload?.exp;
    if (!exp) return true;
    return exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class LoginGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    const inFlow = sessionStorage.getItem('auth.loginDone') === '1';
    if (inFlow) return true;

    const token = localStorage.getItem('token');
    if (token && !isTokenExpired(token)) {
      this.router.navigateByUrl('/', { replaceUrl: true });
      return false;
    }
    return true;
  }
}
