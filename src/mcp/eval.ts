import { Page } from 'playwright';
import vm from 'vm';

// Not super secure, but it's ok for now
export const secureEvalAsync = async (
  page: Page,
  code: string,
  context = {}
) => {
  // Set default options
  const timeout = 20000;
  const filename = 'eval.js';

  let logs: string[] = [];
  let errors: string[] = [];

  // Code should already be a function declaration
  // Just need to execute it with page argument
  const wrappedCode = `
    ${code}
    run(page);
  `;

  // Create restricted sandbox with provided context
  const sandbox = {
    // Core async essentials
    Promise,
    setTimeout,
    clearTimeout,
    setImmediate,
    clearImmediate,

    // Pass page object to sandbox
    page,

    // Capture all console methods
    console: {
      log: (...args: any[]) => {
        const msg = args.map(arg => String(arg)).join(' ');
        logs.push(`[log] ${msg}`);
      },
      error: (...args: any[]) => {
        const msg = args.map(arg => String(arg)).join(' ');
        errors.push(`[error] ${msg}`);
      },
      warn: (...args: any[]) => {
        const msg = args.map(arg => String(arg)).join(' ');
        logs.push(`[warn] ${msg}`);
      },
      info: (...args: any[]) => {
        const msg = args.map(arg => String(arg)).join(' ');
        logs.push(`[info] ${msg}`);
      },
      debug: (...args: any[]) => {
        const msg = args.map(arg => String(arg)).join(' ');
        logs.push(`[debug] ${msg}`);
      },
      trace: (...args: any[]) => {
        const msg = args.map(arg => String(arg)).join(' ');
        logs.push(`[trace] ${msg}`);
      },
    },

    // User-provided context
    ...context,

    // Explicitly block access to sensitive globals
    process: undefined,
    global: undefined,
    require: undefined,
    __dirname: undefined,
    __filename: undefined,
    Buffer: undefined,
  };

  try {
    // Create context and script
    const vmContext = vm.createContext(sandbox);
    const script = new vm.Script(wrappedCode, { filename });

    // Execute and await result
    const result = script.runInContext(vmContext);
    const awaitedResult = await result;

    return {
      result: awaitedResult,
      logs,
      errors,
    };
  } catch (error: any) {
    return {
      error: true,
      message: error.message,
      stack: error.stack,
      logs,
      errors,
    };
  }
};
