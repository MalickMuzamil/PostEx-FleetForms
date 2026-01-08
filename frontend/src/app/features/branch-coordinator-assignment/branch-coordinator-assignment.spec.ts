import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchCoordinatorAssignment } from './branch-coordinator-assignment';

describe('BranchCoordinatorAssignment', () => {
  let component: BranchCoordinatorAssignment;
  let fixture: ComponentFixture<BranchCoordinatorAssignment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BranchCoordinatorAssignment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchCoordinatorAssignment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
