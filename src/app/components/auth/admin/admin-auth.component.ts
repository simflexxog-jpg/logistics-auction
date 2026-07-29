import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-auth',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrls: ['./admin-auth.component.css'],
  template: `
    <div class="auth-page">
      <div class="auth-shell">
        <div class="auth-panel">
          <div class="auth-panel-inner text-center">
            <h2 class="fw-bold mb-3">Admin Access</h2>
            <p class="text-muted">Use the admin console to manage partners, approvals, and audits.</p>
            <div class="d-grid gap-2 mt-4">
              <a [routerLink]="['/login']" [queryParams]="{ admin: true }" class="btn btn-primary">Admin Sign In</a>
              <a routerLink="/register/admin" class="btn btn-outline-secondary">Register as Admin</a>
            </div>
            <div class="mt-3 small text-muted">Only create admin accounts if you have the admin secret.</div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminAuthComponent {}
