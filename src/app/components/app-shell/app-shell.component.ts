import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html'
})
export class AppShellComponent {
  sidebarCollapsed = false;
  tenantOptions = [
    { value: 'default', label: 'Default Organization' },
    { value: 'acme', label: 'Acme Logistics' },
    { value: 'northstar', label: 'NorthStar Freight' },
    { value: 'bluepeak', label: 'BluePeak Transport' }
  ];

  constructor(public auth: AuthService, private router: Router) {}

  get role(): 'customer' | 'partner' {
    const u = this.auth.currentUser();
    return (u?.role as 'customer' | 'partner') || 'customer';
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  get selectedTenantId(): string {
    return this.auth.getSelectedTenantId();
  }

  updateSelectedTenant(tenantId: string) {
    this.auth.setSelectedTenantId(tenantId);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
