import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SocketService } from '../../../services/socket.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrls: ['./register-admin.css', './register.component.css'],
  templateUrl: './register.component.html'
})
export class RegisterComponent implements OnInit {
  role: 'customer' | 'partner' = 'customer';
  form: any = { name: '', email: '', password: '', phone: '', truckType: '', truckCapacity: '', licensePlate: '' };
  error = signal('');
  loading = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private socket: SocketService
  ) {}

  ngOnInit() {
    const param = this.route.snapshot.params['role'];
    this.role = param === 'partner' ? 'partner' : 'customer';
  }

  submit() {
    this.error.set('');
    this.loading.set(true);
    const payload = { ...this.form, role: this.role } as any;

    this.auth.register(payload).subscribe({
      next: (res) => {
        this.socket.connect(res.token);
        if (res.user?.isAdmin) {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate([this.role === 'customer' ? '/customer/listings' : '/partner/dashboard']);
        }
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Registration failed');
        this.loading.set(false);
      }
    });
  }
}
