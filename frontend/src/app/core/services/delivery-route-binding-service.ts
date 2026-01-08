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

  // general branches (independent)
  getBranches(): Observable<any> {
    return this.api.get<any>('/branches');
  }

  // general sub-branches (by branch only)
  getSubBranchesByBranch(branchId: number): Observable<any> {
    return this.api.get<any>(`/branches/${branchId}/sub-branches`);
  }

  // ----------------- DEPENDENT DROPDOWNS -----------------
  // Route -> Branches
  getBranchesByRoute(deliveryRouteId: number): Observable<any> {
    return this.api.get<any>(
      `${this.baseUrl}/route/${deliveryRouteId}/branches`
    );
  }

  // Route + Branch -> SubBranches
  getSubBranchesByRouteAndBranch(
    deliveryRouteId: number,
    branchId: number
  ): Observable<any> {
    return this.api.get<any>(
      `${this.baseUrl}/route/${deliveryRouteId}/branch/${branchId}/sub-branches`
    );
  }
}
