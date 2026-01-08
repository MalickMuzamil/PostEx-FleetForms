import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliveryRouteBindingComponent } from './delivery-route-binding-component';

describe('DeliveryRouteBindingComponent', () => {
  let component: DeliveryRouteBindingComponent;
  let fixture: ComponentFixture<DeliveryRouteBindingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryRouteBindingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliveryRouteBindingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
