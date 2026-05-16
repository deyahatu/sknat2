// Lightweight timeout wrapper for promises that talk to external systems
// (email, payment gateway, etc.). When the timeout fires we throw a
// TimeoutError so the caller can return a specific Arabic message instead
// of letting the request hang for the full SMTP/HTTP timeout.

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeoutError";
    this.isTimeout = true;
  }
}

export function withTimeout(promise, ms, label = "operation") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
