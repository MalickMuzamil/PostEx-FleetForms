import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class CallLogsService {
  private readonly baseUrl = '/call-logs';

  constructor(private api: GeneralService) {}

  getAll(): Observable<any> {
    return this.api.get<any>(this.baseUrl);
  }

  validateBulk(payloads: any[]): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/validate-bulk`, { payloads });
  }

  importBulk(payloads: any[]): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/bulk-import`, { payloads });
  }
}