// Filter harmless internal Firestore GrpcConnection idle stream disconnect warnings
if (typeof window !== 'undefined' && window.console) {
  const origConsoleError = window.console.error;
  window.console.error = (...args: any[]) => {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    if (
      msg.includes('CANCELLED: Disconnecting idle stream') ||
      msg.includes('Timed out waiting for new targets') ||
      (msg.includes('GrpcConnection') && msg.includes('Code: 1'))
    ) {
      // Benign gRPC stream idle cleanup: silently ignore
      return;
    }
    origConsoleError.apply(window.console, args);
  };
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

