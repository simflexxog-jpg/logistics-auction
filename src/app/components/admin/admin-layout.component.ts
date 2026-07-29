import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  template: `
    <div class="admin-layout d-flex">
      <aside class="admin-sidebar p-3 bg-light" style="width:240px;min-height:100vh;">
        <div class="mb-4">
          <div class="fw-bold">Admin Console</div>
          <div class="text-muted small">{{auth.currentUser()?.name}}</div>
        </div>
        <nav class="nav flex-column">
          <a class="nav-link" routerLink="/admin">Dashboard</a>
          <a class="nav-link" routerLink="/admin/users">Users</a>
          <a class="nav-link" routerLink="/admin/audit">Audit Logs</a>
          <a class="nav-link" routerLink="/admin/partners">Partners</a>
        </nav>
      </aside>
      <main class="flex-grow-1 p-3">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AdminLayoutComponent {
  constructor(public auth: AuthService) {}
}
