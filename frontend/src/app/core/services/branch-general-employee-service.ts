import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BranchGeneralEmployeeService {
  private endpoint = '/branch-general-emp-binding';

  constructor(private api: GeneralService) {}

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
    return this.api
      .get<any>(this.endpoint)
      .pipe(map((res) => res?.data ?? res ?? []));
  }

  getBranches() {
    return this.api.get<any[]>(`${this.endpoint}/branches`);
  }

  getEmployees() {
    return this.api.get<any[]>(`${this.endpoint}/employees/active`);
  }
}
