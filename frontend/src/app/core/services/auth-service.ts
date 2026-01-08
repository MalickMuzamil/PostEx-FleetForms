import { Injectable } from '@angular/core';
import { BehaviorSubject, tap, catchError, of, map, Observable } from 'rxjs';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authed$ = new BehaviorSubject<boolean>(false);
  private endpoint = '/auth';

  constructor(private api: GeneralService) {}

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
    this.setAuthenticated(false);
  }

  hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  login(payload: { email: string; password: string }): Observable<any> {
    return this.api.post(`${this.endpoint}/login`, payload);
  }

  signup(payload: { name: string; email: string; password: string }): Observable<any> {
    return this.api.post(`${this.endpoint}/signup`, payload);
  }

}
