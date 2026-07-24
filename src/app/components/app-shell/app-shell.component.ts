import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html'
})
export class AppShellComponent {
  constructor(public auth: AuthService, private router: Router) {}

  get role(): 'customer' | 'partner' {
    return (this.auth.currentUser()?.role as 'customer' | 'partner') || 'customer';
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
