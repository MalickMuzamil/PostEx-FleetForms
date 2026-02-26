import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourierFakeAttempts } from './courier-fake-attempts';

describe('CourierFakeAttempts', () => {
  let component: CourierFakeAttempts;
  let fixture: ComponentFixture<CourierFakeAttempts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourierFakeAttempts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CourierFakeAttempts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
