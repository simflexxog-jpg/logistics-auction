import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required = route.data['role'];
  if (auth.role === required) return true;
  router.navigate([auth.role === 'customer' ? '/customer/listings' : '/partner/dashboard']);
  return false;
};
