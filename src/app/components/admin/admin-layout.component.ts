import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  styleUrls: ['./admin-layout.component.css'],
  template: `
    <div class="admin-layout d-flex">
      <aside class="admin-sidebar p-3">
        <div class="sidebar-brand mb-4">
          <div class="brand-mark text-white mb-2">ADM</div>
          <div>
            <div class="fw-bold h5 mb-1">Admin Console</div>
            <div class="text-muted small">{{ auth.currentUser()?.name || 'Administrator' }}</div>
          </div>
        </div>
        <nav class="nav flex-column gap-2">
          <a class="nav-link" routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
          <a class="nav-link" routerLink="/admin/users" routerLinkActive="active">Users</a>
          <a class="nav-link" routerLink="/admin/audit" routerLinkActive="active">Audit Logs</a>
          <a class="nav-link" routerLink="/admin/partners" routerLinkActive="active">Partners</a>
        </nav>
        <div class="admin-sidebar-footer mt-auto pt-3 border-top">
          <button class="btn btn-outline-light w-100" type="button" (click)="auth.logout()">Logout</button>
        </div>
      </aside>
      <main class="flex-grow-1 p-4 admin-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AdminLayoutComponent {
  constructor(public auth: AuthService) {}
}
