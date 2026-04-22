import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZongPortal } from './zong-portal';

describe('ZongPortal', () => {
  let component: ZongPortal;
  let fixture: ComponentFixture<ZongPortal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZongPortal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ZongPortal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
