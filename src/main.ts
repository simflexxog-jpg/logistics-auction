import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

async function preBootstrap() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      // store token and try to fetch user
      localStorage.setItem('token', token);
      try {
        const resp = await fetch(`${environment.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) {
          const user = await resp.json();
          localStorage.setItem('user', JSON.stringify(user));
        }
      } catch (e) {
        console.warn('Failed to fetch user after OAuth token', e);
      }
      // remove token from URL
      const cleanUrl = window.location.pathname + window.location.hash;
      history.replaceState(null, '', cleanUrl);
    }
  } catch (e) {
    console.warn('preBootstrap failed', e);
  }
}

(async () => {
  await preBootstrap();
  bootstrapApplication(App, appConfig).catch((err) => console.error(err));
})();
