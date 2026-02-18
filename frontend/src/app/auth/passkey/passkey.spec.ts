import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Passkey } from './passkey';

describe('Passkey', () => {
  let component: Passkey;
  let fixture: ComponentFixture<Passkey>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Passkey]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Passkey);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
