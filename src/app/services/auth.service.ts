import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'partner' | 'admin' | null;
  isAdmin?: boolean;
  avgRating?: number;
  mfaEnabled?: boolean;
  permissions?: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  currentUser = signal<User | null>(this.loadUser());

  constructor(private http: HttpClient, private router: Router) {}

  private loadUser(): User | null {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }

  get token(): string | null {
    return localStorage.getItem('token');
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  get role(): string | null {
    return this.currentUser()?.role ?? null;
  }

  login(email: string, password: string, mfaCode?: string) {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, { email, password, mfaCode }).pipe(
      tap(res => {
        const token = res.accessToken || res.token;
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', res.refreshToken);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.currentUser.set({ ...res.user } as any);
      })
    );
  }

  register(data: any) {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, data).pipe(
      tap(res => {
        const token = res.accessToken || res.token;
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', res.refreshToken);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.currentUser.set({ ...res.user } as any);
      })
    );
  }

  logout() {
    localStorage.clear();
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  setupMfa() {
    return this.http.post<{ secret: string; code: string }>(`${this.apiUrl}/auth/mfa/setup`, {}, { headers: this.authHeaders() });
  }

  verifyMfa(code: string) {
    return this.http.post<any>(`${this.apiUrl}/auth/mfa/verify`, { code }, { headers: this.authHeaders() });
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.token}` };
  }

  // Accept a token (from OAuth redirect), store it and load the user
  handleToken(token: string) {
    localStorage.setItem('token', token);
    return this.http.get<User>(`${this.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).pipe(
      tap(user => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUser.set(user as any);
      })
    );
  }
}
