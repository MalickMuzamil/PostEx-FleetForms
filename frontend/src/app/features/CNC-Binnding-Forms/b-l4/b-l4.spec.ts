import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BL4 } from './b-l4';

describe('BL4', () => {
  let component: BL4;
  let fixture: ComponentFixture<BL4>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BL4]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BL4);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
