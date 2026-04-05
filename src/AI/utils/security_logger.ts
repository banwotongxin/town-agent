export class SecurityLogger {
  info(message: string, metadata: any = {}) {
    this._log('INFO', message, metadata);
  }

  warn(message: string, metadata: any = {}) {
    this._log('WARN', message, metadata);
  }

  error(message: string, metadata: any = {}) {
    this._log('ERROR', message, metadata);
  }

  private _log(level: string, message: string, metadata: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, metadata);
  }
}