import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliveryRouteDefinitionComponent } from './delivery-route-definition-component';

describe('DeliveryRouteDefinitionComponent', () => {
  let component: DeliveryRouteDefinitionComponent;
  let fixture: ComponentFixture<DeliveryRouteDefinitionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryRouteDefinitionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliveryRouteDefinitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
