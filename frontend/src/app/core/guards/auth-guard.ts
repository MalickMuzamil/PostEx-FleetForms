import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload?.exp;
    if (!exp) return true;
    return exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

 canActivate(): boolean {
  // ✅ Prefer PostEx access token
  const token =
    localStorage.getItem('postex.access_token') ||
    localStorage.getItem('postex-auth-token');

  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('postex.access_token');
    localStorage.removeItem('postex.refresh_token');
    localStorage.removeItem('postex.user');
    localStorage.removeItem('postex-auth-token');

    localStorage.removeItem('postex-auth-token');
    localStorage.removeItem('UserData');

    this.router.navigate(['/auth/login']);
    return false;
  }

  return true;
}
}