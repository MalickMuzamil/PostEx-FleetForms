import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CncLevel } from './cnc-level';

describe('CncLevel', () => {
  let component: CncLevel;
  let fixture: ComponentFixture<CncLevel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CncLevel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CncLevel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
