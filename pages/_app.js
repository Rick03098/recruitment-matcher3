import '../styles/globals.css';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origFetch = window.fetch;
      window.fetch = function(...args) {
        if (typeof args[0] === 'string' && args[0].includes('/api/parseJDFile')) {
          console.warn('全局拦截到 fetch /api/parseJDFile:', args, new Error('调用栈').stack);
        }
        return origFetch.apply(this, args);
      };
    }
  }, []);
  return <Component {...pageProps} />;
}

export default MyApp;
