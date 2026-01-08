import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class BranchDashboardBindingService {
  private baseUrl = '/branch-dashboard-binding';

  constructor(private api: GeneralService) {}

  getBranches(): Observable<any> {
    return this.api.get<any>(`${this.baseUrl}/branches`);
  }

  getAll(): Observable<any> {
    return this.api.get<any>(this.baseUrl);
  }

  create(payload: any): Observable<any> {
    return this.api.post<any>(this.baseUrl, payload);
  }

  update(id: number, payload: any): Observable<any> {
    return this.api.put<any>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<any> {
    return this.api.delete<any>(`${this.baseUrl}/${id}`);
  }
}
