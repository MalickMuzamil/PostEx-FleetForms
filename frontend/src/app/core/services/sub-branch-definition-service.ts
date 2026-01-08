import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class SubBranchDefinitionService {
  private endpoint = '/sub-branches'; // ✅ if backend mounted on /api

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
    return this.api.get<any[]>(this.endpoint);
  }
  getBranches() {
    return this.api.get<any[]>(`${this.endpoint}/branches`);
  }

  getSubBranchesByBranchId(branchId: number) {
    return this.api.get<any[]>(
      `${this.endpoint}?branchId=${branchId}&_=${Date.now()}`
    );
  }
}
