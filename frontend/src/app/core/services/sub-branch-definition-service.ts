import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';

@Injectable({ providedIn: 'root' })
export class SubBranchDefinitionService {
  private endpoint = '/sub-branches';

  constructor(private api: GeneralService) {}

  // ---------- CREATE ----------
  create(payload: any) {
    return this.api.post(this.endpoint, payload);
  }

  // ---------- UPDATE ----------
  update(id: number, payload: any) {
    return this.api.put(`${this.endpoint}/${id}`, payload);
  }

  // ---------- DELETE ----------
  delete(id: number) {
    return this.api.delete(`${this.endpoint}/${id}`);
  }

  // ---------- GET BY ID ----------
  getById(id: number) {
    return this.api.get(`${this.endpoint}/${id}`);
  }

  // ---------- LIST ALL (TABLE: ACTIVE ONLY) ----------
  getAll() {
    return this.api.get<any[]>(this.endpoint);
  }

  // ---------- BRANCHES (DROPDOWN) ----------
  getBranches() {
    return this.api.get<any[]>(`${this.endpoint}/branches`);
  }


  //There is only sub branches showing which are only in this table. IF BranchID exist then only sub branches are showing which are are exist in this table.
  getSubBranchesByBranchId(branchId: number, includeInactive = false) {
    const extra = includeInactive ? '&includeInactive=1' : '';
    return this.api.get<any[]>(
      `${this.endpoint}?branchId=${branchId}${extra}&_=${Date.now()}`
    );
  }
}
