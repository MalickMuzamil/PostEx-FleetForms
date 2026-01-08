import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubBranchDefinition } from './sub-branch-definition';

describe('SubBranchDefinition', () => {
  let component: SubBranchDefinition;
  let fixture: ComponentFixture<SubBranchDefinition>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubBranchDefinition]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubBranchDefinition);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
