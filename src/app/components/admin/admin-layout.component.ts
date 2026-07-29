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
          <div class="brand-mark sidebar-symbol">
            <img class="brand-logo-image" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJyZW50YS1mYXN0IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMjJkM2VlIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjM2I4MmY2Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHBhdGggZD0iTTIyIDUyIEwzMCAxNiIgc3Ryb2tlPSJ1cmwoI3JlbnRhLWZhc3QpIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0zMCAxNiBINDQgQzUwLjYgMTYgNTIgMjMgNDggMzAgQzQ0IDM3IDM4IDM2IDM0IDM2IiBzdHJva2U9InVybCgjcmVudGEtZmFzdCkiIHN0cm9rZS13aWR0aD0iNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTM2IDM2IEw1MCA1MiIgc3Ryb2tlPSIjMjJkM2VlIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik00MCA1MiBINTAgVjQyIiBzdHJva2U9IiMyMmQzZWUiIHN0cm9rZS13aWR0aD0iNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+" alt="Renta logo">
          </div>
          <div class="brand-copy">
            <div class="brand-kicker">Renta</div>
            <div class="brand-title">Admin Console</div>
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
