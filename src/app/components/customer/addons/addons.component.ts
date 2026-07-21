import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-customer-addons',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './addons.component.html'
})
export class CustomerAddonsComponent implements OnInit {
  addons = signal<any[]>([]);
  loading = signal(true);
  showForm = signal(false);
  submitting = signal(false);
  error = signal('');
  success = signal('');

  form: any = {
    title: '', description: '', weight: '',
    pickupAddress: '', pickupLat: '', pickupLng: '',
    dropoffAddress: '', dropoffLat: '', dropoffLng: '',
    price: ''
  };

  constructor(private api: ApiService, public auth: AuthService) {}

  ngOnInit() { this.load(); }

  load() {
    this.api.getAddOns().subscribe({
      next: d => { this.addons.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  submit() {
    this.submitting.set(true);
    this.api.createAddOn(this.form).subscribe({
      next: () => {
        this.success.set('Add-on shipment posted!');
        this.showForm.set(false);
        this.submitting.set(false);
        this.form = { title:'', description:'', weight:'', pickupAddress:'', pickupLat:'', pickupLng:'', dropoffAddress:'', dropoffLat:'', dropoffLng:'', price:'' };
        this.load();
      },
      error: err => { this.error.set(err.error?.error || 'Failed'); this.submitting.set(false); }
    });
  }
}
