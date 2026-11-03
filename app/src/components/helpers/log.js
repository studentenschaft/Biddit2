// The one sanctioned console wrapper. debug/info only print in development
// builds; warn/error always reach the console.
export const log = {
  debug: (...args) => {
    if (import.meta.env.DEV) console.log(...args);
  },
  info: (...args) => {
    if (import.meta.env.DEV) console.info(...args);
  },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export default log;
