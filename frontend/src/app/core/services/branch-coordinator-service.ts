import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class BranchCoordinatorService {
  private endpoint = '/bindings';

  constructor(private api: GeneralService) {}

  // ========================
  // CRUD – Assignment
  // ========================

  create(payload: any) {
    return this.api.post(this.endpoint, payload);
  }

  update(id: number, payload: any) {
    return this.api.put(`${this.endpoint}/${id}`, payload);
  }

  delete(id: number) {
    return this.api.delete(`${this.endpoint}/${id}`);
  }

  getById(id: number) {
    return this.api.get(`${this.endpoint}/${id}`);
  }

  getAll() {
    return this.api.get<any[]>(this.endpoint);
  }

  getBranches() {
    return this.api.get<any[]>(`${this.endpoint}/branches`); 
  }

  getEmployees() {
    return this.api.get<any[]>(`${this.endpoint}/employees/active`);
  }
}
