import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { Passkey } from '../../auth/passkey/passkey';

@Injectable({ providedIn: 'root' })
export class PasskeyDeactivateGuard implements CanDeactivate<Passkey> {
  canDeactivate(component: Passkey): boolean {
    if (component.allowLeave === true) return true;

    history.pushState(null, '', location.href);
    return false;
  }
}
