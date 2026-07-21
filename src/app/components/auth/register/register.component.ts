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
    this.role = (this.route.snapshot.params['role'] || 'customer') as 'customer' | 'partner';
  }

  submit() {
    this.error.set('');
    this.loading.set(true);
    this.auth.register({ ...this.form, role: this.role }).subscribe({
      next: (res) => {
        this.socket.connect(res.token);
        this.router.navigate([this.role === 'customer' ? '/customer/listings' : '/partner/dashboard']);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Registration failed');
        this.loading.set(false);
      }
    });
  }
}
