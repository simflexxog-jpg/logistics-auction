import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html'
})
export class SupportComponent implements OnInit {
  loading = signal(true);
  aiLoading = signal(false);
  supportMessages = signal<any[]>([]);
  supportInput = signal('');
  error = signal('');

  constructor(private api: ApiService, public auth: AuthService) {}

  ngOnInit() {
    this.supportMessages.set([
      { role: 'assistant', text: 'Welcome to 24/7 support. Ask about shipment routing, add-on eligibility, or pricing strategy.' }
    ]);
    this.loading.set(false);
  }

  sendSupportMessage() {
    const prompt = this.supportInput().trim();
    if (!prompt) return;
    this.supportMessages.update(msgs => [...msgs, { role: 'user', text: prompt }]);
    this.supportInput.set('');
    this.aiLoading.set(true);
    this.error.set('');

    this.api.querySupport(prompt).subscribe({
      next: (resp) => {
        const text = resp?.reply || resp?.message || 'Support is unavailable right now.';
        this.supportMessages.update(msgs => [...msgs, { role: 'assistant', text }]);
        this.aiLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Unable to reach support.');
        this.aiLoading.set(false);
      }
    });
  }
}
