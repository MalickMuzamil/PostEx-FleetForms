import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment/environment';

@Injectable({ providedIn: 'root' })
export class GeneralService {

  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`);
  }

  post<T>(endpoint: string, payload: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, payload);
  }

  put<T>(endpoint: string, payload: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, payload);
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`);
  }
}