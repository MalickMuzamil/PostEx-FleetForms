import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environment/environment';

@Injectable({ providedIn: 'root' })
export class GeneralService {
  private baseUrl = environment.apiBaseUrl;

  private cache = new Map<string, { expiry: number; response$: Observable<any> }>();
  private cacheTTL = 30 * 1000; // 30 seconds

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const now = Date.now();

    const cached = this.cache.get(url);

    if (cached && cached.expiry > now) {
      return cached.response$ as Observable<T>;
    }

    const response$ = this.http.get<T>(url).pipe(
      shareReplay(1)
    );

    this.cache.set(url, {
      expiry: now + this.cacheTTL,
      response$: response$
    });

    return response$;
  }

  post<T>(endpoint: string, payload: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, payload).pipe(
      tap(() => this.clearCacheByEndpoint(endpoint))
    );
  }

  put<T>(endpoint: string, payload: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, payload).pipe(
      tap(() => this.clearCacheByEndpoint(endpoint))
    );
  }

  delete<T>(endpoint: string, body?: any): Observable<T> {
    const options = body ? { body } : {};
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`, options).pipe(
      tap(() => this.clearCacheByEndpoint(endpoint))
    );
  }

  clearAllCache(): void {
    this.cache.clear();
  }

  private clearCacheByEndpoint(endpoint: string): void {
    const fullUrl = `${this.baseUrl}${endpoint}`;
    const basePath = fullUrl.split('/').slice(0, -1).join('/');

    Array.from(this.cache.keys()).forEach((key) => {
      if (key.startsWith(fullUrl) || key.startsWith(basePath)) {
        this.cache.delete(key);
      }
    });
  }
}