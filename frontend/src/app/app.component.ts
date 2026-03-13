import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UwHeaderComponent } from './components/uw-header/uw-header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UwHeaderComponent],
  template: `
    <app-uw-header (refresh)="onRefresh()"></app-uw-header>
    <main class="app-main">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .app-main {
      flex: 1;
      overflow-y: auto;
    }
  `],
})
export class AppComponent {
  onRefresh(): void {
    window.dispatchEvent(new CustomEvent('refresh-policies'));
  }
}
