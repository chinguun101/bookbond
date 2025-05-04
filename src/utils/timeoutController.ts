/**
 * Timeout controller for fetch requests
 */
export class TimeoutController {
  controller: AbortController;
  timeoutId: number | null = null;
  
  constructor(timeoutMs: number = 60000) {
    this.controller = new AbortController();
    
    this.timeoutId = window.setTimeout(() => {
      this.controller.abort();
    }, timeoutMs);
  }
  
  clear() {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
} 