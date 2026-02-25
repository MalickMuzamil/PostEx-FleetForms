import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly baseUrl = '/attendance'; 

  constructor(private api: GeneralService) {}

  // ----------------- ATTENDANCE (CRUD) -----------------
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

  // ----------------- MASTER LISTS (optional) -----------------
  getEmployees(): Observable<any> {
    return this.api.get<any>(`${this.baseUrl}/employees`);
  }

  getStatuses(): Observable<any> {
    return this.api.get<any>(`${this.baseUrl}/statuses`);
  }

  // ----------------- BULK (preview/validate/import) -----------------
  validateBulk(payloads: any[]): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/validate-bulk`, { payloads });
  }

  importBulk(payloads: any[]): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/bulk-import`, { payloads });
  }
}