import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required = route.data['role'];
  if (auth.currentUser()?.isAdmin) {
    router.navigate(['/admin']);
    return false;
  }
  if (auth.role === required) return true;
  if (auth.role === 'customer') {
    router.navigate(['/customer/listings']);
  } else if (auth.role === 'partner') {
    router.navigate(['/partner/dashboard']);
  } else {
    router.navigate(['/login']);
  }
  return false;
};
