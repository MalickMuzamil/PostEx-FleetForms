import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchGeneralEmployeeBinding } from './branch-general-employee-binding';

describe('BranchGeneralEmployeeBinding', () => {
  let component: BranchGeneralEmployeeBinding;
  let fixture: ComponentFixture<BranchGeneralEmployeeBinding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BranchGeneralEmployeeBinding]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchGeneralEmployeeBinding);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
