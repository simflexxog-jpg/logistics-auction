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
  tenantId?: string;
  organizationId?: string;
  companyId?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  currentUser = signal<User | null>(this.loadUser());
  tenantOptions = [
    { value: 'default', label: 'Default Organization' },
    { value: 'acme', label: 'Acme Logistics' },
    { value: 'northstar', label: 'NorthStar Freight' },
    { value: 'bluepeak', label: 'BluePeak Transport' }
  ];

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

  getSelectedTenantId(): string {
    return localStorage.getItem('selectedTenantId') || this.currentUser()?.tenantId || 'default';
  }

  setSelectedTenantId(tenantId: string) {
    const normalized = tenantId || 'default';
    localStorage.setItem('selectedTenantId', normalized);
    const user = this.currentUser();
    if (user) {
      const nextUser = { ...user, tenantId: normalized, organizationId: normalized, companyId: normalized };
      localStorage.setItem('user', JSON.stringify(nextUser));
      this.currentUser.set(nextUser);
    }
  }

  private persistSession(token: string, refreshToken: string, user: any, tenantId: string) {
    const normalizedTenant = tenantId || 'default';
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('selectedTenantId', normalizedTenant);
    const sessionUser = {
      ...(user || {}),
      tenantId: normalizedTenant,
      organizationId: normalizedTenant,
      companyId: normalizedTenant
    };
    localStorage.setItem('user', JSON.stringify(sessionUser));
    this.currentUser.set({ ...sessionUser } as any);
  }

  login(email: string, password: string, mfaCode?: string, tenantId = 'default') {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, {
      email,
      password,
      mfaCode,
      tenantId,
      organizationId: tenantId,
      companyId: tenantId
    }).pipe(
      tap(res => {
        const token = res.accessToken || res.token;
        this.persistSession(token, res.refreshToken, res.user, tenantId);
      })
    );
  }

  register(data: any) {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, {
      ...data,
      tenantId: data?.tenantId || 'default',
      organizationId: data?.organizationId || data?.tenantId || 'default',
      companyId: data?.companyId || data?.tenantId || 'default'
    }).pipe(
      tap(res => {
        const token = res.accessToken || res.token;
        const tenantId = data?.tenantId || data?.organizationId || data?.companyId || 'default';
        this.persistSession(token, res.refreshToken, res.user, tenantId);
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
