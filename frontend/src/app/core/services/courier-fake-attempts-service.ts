import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class CourierFakeAttemptsService {
    private readonly baseUrl = '/courier-fake-attempts';

    constructor(private api: GeneralService) { }

    // ----------------- LIST -----------------
    getAll(): Observable<any> {
        return this.api.get<any>(this.baseUrl);
    }

    // ----------------- BULK (optional validate later) -----------------
    validateBulk(payloads: any[]): Observable<any> {
        return this.api.post<any>(`${this.baseUrl}/validate-bulk`, { payloads });
    }

    importBulk(payloads: any[]): Observable<any> {
        return this.api.post<any>(`${this.baseUrl}/bulk-import`, { payloads });
    }
}