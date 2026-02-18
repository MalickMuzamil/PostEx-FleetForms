import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OTP } from './otp';

describe('OTP', () => {
  let component: OTP;
  let fixture: ComponentFixture<OTP>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OTP]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OTP);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
