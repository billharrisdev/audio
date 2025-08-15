import { Routes } from '@angular/router';
import { SourceSeparatorComponent } from './components/source-separator/source-separator.component';

export const routes: Routes = [
  { path: '', component: SourceSeparatorComponent },
  { path: '**', redirectTo: '' }
];
