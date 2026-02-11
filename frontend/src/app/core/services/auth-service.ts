import { Injectable } from '@angular/core';
import { BehaviorSubject, tap, catchError, of, map, Observable } from 'rxjs';
import { GeneralService } from './general-service';
import { Router } from '@angular/router';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private authed$ = new BehaviorSubject<boolean>(false);
  private endpoint = '/auth';

  constructor(private api: GeneralService, private router: Router) { }

  isAuthenticatedSync() {
    return this.authed$.value;
  }

  setAuthenticated(val: boolean) {
    this.authed$.next(val);
  }

  verifyToken() {
    return this.api.get('/auth/verify').pipe(
      tap(() => {
        console.log('Token verified');
        this.setAuthenticated(true);
      })
    );
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

  login(payload: { username: string; password: string }): Observable<any> {
    return this.api.post(`${this.endpoint}/login`, payload);
  }

  signup(payload: { name: string; email: string; password: string }): Observable<any> {
    return this.api.post(`${this.endpoint}/signup`, payload);
  }

}
