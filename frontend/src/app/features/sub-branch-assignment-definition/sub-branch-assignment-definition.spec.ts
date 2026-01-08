import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubBranchAssignmentDefinition } from './sub-branch-assignment-definition';

describe('SubBranchAssignmentDefinition', () => {
  let component: SubBranchAssignmentDefinition;
  let fixture: ComponentFixture<SubBranchAssignmentDefinition>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubBranchAssignmentDefinition]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubBranchAssignmentDefinition);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
