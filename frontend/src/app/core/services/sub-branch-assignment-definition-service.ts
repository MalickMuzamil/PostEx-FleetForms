import { Injectable } from '@angular/core';
import { GeneralService } from './general-service';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SubBranchAssignmentDefinitionService {
  private endpoint = '/sub-branch-assignment-definition';

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

  getSubBranches() {
    return this.api
      .get<any>(`${this.endpoint}/sub-branches`)
      .pipe(map((res) => res?.data ?? res ?? []));
  }

  getSubBranchById(subBranchId: number) {
    return this.api.get(`${this.endpoint}/sub-branches/${subBranchId}`);
  }

  getActiveEmployeesByBranch(branchId: number) {
    return this.api
      .get<any>(
        `${this.endpoint}/employees/active?branchId=${branchId}&_=${Date.now()}`
      )
      .pipe(map((res) => res?.data ?? res ?? []));
  }
}
