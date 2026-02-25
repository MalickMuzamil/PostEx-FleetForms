import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttendanceReport } from './attendance-report';

describe('AttendanceReport', () => {
  let component: AttendanceReport;
  let fixture: ComponentFixture<AttendanceReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendanceReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttendanceReport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
