import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class DeliveryRouteBindingService {
  private readonly baseUrl = '/delivery-route-bindings';

  constructor(private api: GeneralService) {}

  // ----------------- BINDINGS -----------------
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

  // ----------------- MASTER LISTS -----------------
  getDeliveryRoutes(): Observable<any> {
    return this.api.get<any>(`${this.baseUrl}/delivery-routes`);
  }

  // (optional) general endpoints if you still need them elsewhere
  getBranches(): Observable<any> {
    return this.api.get<any>('/branches');
  }

  getSubBranchesByBranch(branchId: number): Observable<any> {
    return this.api.get<any>(`/branches/${branchId}/sub-branches`);
  }

  // ----------------- DEPENDENT DROPDOWNS (SINGLE) -----------------
  // Keep old ones if used anywhere else in app
  getBranchesByRoute(deliveryRouteId: number): Observable<any> {
    return this.api.get<any>(
      `${this.baseUrl}/route/${deliveryRouteId}/branches`
    );
  }

  getSubBranchesByRouteAndBranch(
    deliveryRouteId: number,
    branchId: number
  ): Observable<any> {
    return this.api.get<any>(
      `${this.baseUrl}/route/${deliveryRouteId}/branch/${branchId}/sub-branches`
    );
  }

  // ----------------- DEPENDENT DROPDOWNS (BULK) ✅ NEW -----------------
  // POST /delivery-route-bindings/routes/branches
  // body: { routeIds: number[] }
  getBranchesByRoutes(routeIds: number[]): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/routes/branches`, { routeIds });
  }

  // POST /delivery-route-bindings/routes/branches/sub-branches
  // body: { pairs: { routeId:number, branchId:number }[] }
  getSubBranchesByRoutesAndBranches(
    pairs: Array<{ routeId: number; branchId: number }>
  ): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/routes/branches/sub-branches`, {
      pairs,
    });
  }

  // ----------------- BULK VALIDATION (optional) -----------------
  // If your backend already exposes validateBulk via same controller/service,
  // you can call it like this. (Adjust path if you add a dedicated route.)
  validateBulk(payloads: any[]): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/validate-bulk`, { payloads });
  }
}
