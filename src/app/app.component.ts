import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SourceSeparatorComponent } from './components/source-separator/source-separator.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SourceSeparatorComponent],
  template: `
    <div class="container">
      <h1>Audio Stem Removal <span class="badge">MVP</span></h1>
      <p class="small">Client-side heuristic demo. For quality separation, integrate a proper ML model later.</p>
      <router-outlet />
      <footer>
        <p>Educational demo. No server – all processing happens in your browser. <a class="link" href="https://github.com/billharrisdev/audio" target="_blank" rel="noopener">Source</a></p>
      </footer>
    </div>
  `
})
export class AppComponent {}
