import pino from 'pino';

// Cloud Logging expects severity field, not level
const levelToSeverity: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label) {
      return { severity: levelToSeverity[label] ?? 'DEFAULT', level: label };
    },
    log(object) {
      // Map pino's err to Cloud Logging's @type for error reporting
      const { err, ...rest } = object as Record<string, unknown>;
      if (err instanceof Error) {
        return {
          ...rest,
          '@type': 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
          message: err.message,
          stack_trace: err.stack,
        };
      }
      return object;
    },
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});
