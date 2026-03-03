import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchCalender } from './branch-calender';

describe('BranchCalender', () => {
  let component: BranchCalender;
  let fixture: ComponentFixture<BranchCalender>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BranchCalender]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchCalender);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
