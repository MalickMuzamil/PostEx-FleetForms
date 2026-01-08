import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchDashboardBindingComponent } from './branch-dashboard-binding-component';

describe('BranchDashboardBindingComponent', () => {
  let component: BranchDashboardBindingComponent;
  let fixture: ComponentFixture<BranchDashboardBindingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BranchDashboardBindingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchDashboardBindingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
