import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';
import { SocketService } from '../../../services/socket.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrls: ['./login-admin.css', './login.component.css'],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  email = '';
  password = '';
  mfaCode = '';
  error = signal('');
  loading = signal(false);
  oauthUrl = environment.apiUrl + '/auth/google';
  requiresMfa = signal(false);

  adminMode = false;

  constructor(private auth: AuthService, private router: Router, private socket: SocketService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const isAdmin = this.route.snapshot.queryParamMap.get('admin');
    this.adminMode = isAdmin === 'true' || isAdmin === '1' || isAdmin === '';
  }

  submit() {
    this.error.set('');
    this.loading.set(true);
    this.auth.login(this.email, this.password, this.mfaCode || undefined).subscribe({
      next: (res) => {
        this.socket.connect(res.token);
        const user = res.user;
        if (user?.isAdmin) {
          this.router.navigate(['/admin']);
        } else {
          const role = user?.role;
          this.router.navigate([role === 'customer' ? '/customer/listings' : '/partner/dashboard']);
        }
      },
      error: (err) => {
        if (err.error?.error === 'MFA code required') {
          this.requiresMfa.set(true);
        }
        this.error.set(err.error?.error || 'Login failed');
        this.loading.set(false);
      }
    });
  }
}
