import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly baseUrl = '/reports';

  constructor(private api: GeneralService) {}

  verifyUser(email: string): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/branch-report`, { email });
  }
}