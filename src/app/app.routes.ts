import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./components/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./components/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'register/:role',
    loadComponent: () => import('./components/auth/register/register.component').then(m => m.RegisterComponent)
  },

  // Customer routes
  {
    path: 'customer',
    canActivate: [authGuard, roleGuard],
    data: { role: 'customer' },
    loadComponent: () => import('./components/app-shell/app-shell.component').then(m => m.AppShellComponent),
    children: [
      {
        path: 'listings',
        loadComponent: () => import('./components/customer/listings/listings.component').then(m => m.CustomerListingsComponent)
      },
      {
        path: 'listing/:id',
        loadComponent: () => import('./components/customer/listing-detail/listing-detail.component').then(m => m.ListingDetailComponent)
      },
      {
        path: 'addons',
        loadComponent: () => import('./components/customer/addons/addons.component').then(m => m.CustomerAddonsComponent)
      },
      {
        path: 'order-history',
        loadComponent: () => import('./components/customer/order-history/order-history.component').then(m => m.OrderHistoryComponent)
      },
      {
        path: 'support',
        loadComponent: () => import('./components/support/support.component').then(m => m.SupportComponent)
      },
      { path: '', redirectTo: 'listings', pathMatch: 'full' }
    ]
  },

  // Partner routes
  {
    path: 'partner',
    canActivate: [authGuard, roleGuard],
    data: { role: 'partner' },
    loadComponent: () => import('./components/app-shell/app-shell.component').then(m => m.AppShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./components/partner/dashboard/dashboard.component').then(m => m.PartnerDashboardComponent)
      },
      {
        path: 'auction',
        loadComponent: () => import('./components/partner/auction/auction.component').then(m => m.PartnerAuctionComponent)
      },
      {
        path: 'jobs',
        loadComponent: () => import('./components/partner/jobs/jobs.component').then(m => m.PartnerJobsComponent)
      },
      {
        path: 'addons',
        loadComponent: () => import('./components/partner/addons/addons.component').then(m => m.PartnerAddonsComponent)
      },      {
        path: 'support',
        loadComponent: () => import('./components/support/support.component').then(m => m.SupportComponent)
      },      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: '/login' }
];
