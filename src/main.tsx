import { render } from 'preact';
import { App } from './app';
import { setupPwa } from './pwa';
import './styles/base.css';
import './styles/kid.css';
import './styles/parent.css';

setupPwa();
// …/pico/#test : page de diagnostic de l'appareil (stockage, réseau, son, paysage).
if (location.hash === '#test') void import('./diag');
else render(<App />, document.getElementById('app')!);
