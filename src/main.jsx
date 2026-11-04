import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import App from './App.jsx';
import './index.css';

// index.html ships a static title, description and canonical for bots that
// never run JS. Every page renders its own via PageMeta, which React 19 hoists
// into <head> but does not dedupe against existing tags, so drop the static
// copies first or the head would hold two of each.
document.head.querySelectorAll('[data-static-head]').forEach((el) => el.remove());

const root = createRoot(document.getElementById('root'));
root.render(
    <BrowserRouter>
        <App />
    </BrowserRouter>
);
