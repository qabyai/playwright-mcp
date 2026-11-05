import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { chromium, BrowserContext, Browser, Page } from 'playwright';
import { secureEvalAsync } from './eval.js';
import { capture, setMcpClientInfo } from '../lib/posthog-server.js';
import { createSnapshot } from '../snapshot';
import { createFullSnapshot } from '../snapshot/full-snapshot';
import { createTextSnapshot } from '../snapshot/text-snapshot';
import { injectDiscordButton } from './toolbox.js';

let browser: Browser;
let context: BrowserContext;
let page: Page;

const server = new McpServer({
  name: 'playwright',
  version: '1.0.0',
});

// Capture MCP client information for analytics
let clientInfoStored = false;

// Intercept initialization to capture client info
const originalConnect = server.connect.bind(server);
server.connect = async function (transport: any) {
  // Override the transport's onmessage to capture initialization
  const originalOnMessage = transport.onmessage;
  transport.onmessage = (message: any) => {
    try {
      // Handle both string and object messages
      const parsed =
        typeof message === 'string' ? JSON.parse(message) : message;

      if (
        parsed.method === 'initialize' &&
        parsed.params?.clientInfo &&
        !clientInfoStored
      ) {
        setMcpClientInfo({
          name: parsed.params.clientInfo.name,
          version: parsed.params.clientInfo.version,
        });
        clientInfoStored = true;
      }
    } catch (e) {
      // Silently ignore parsing errors
    }

    // Call the original handler
    if (originalOnMessage) {
      originalOnMessage(message);
    }
  };

  return originalConnect(transport);
};

server.registerPrompt(
  'server-flow',
  {
    title: 'Server Flow',
    description: 'Get prompt on how to use this MCP server',
    argsSchema: {},
  },
  () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `# DON'T ASSUME ANYTHING. Whatever you write in code, it must be found in the context. Otherwise leave comments.

## Goal
Help me write playwright code with following functionalities:
- [[add semi-high level functionality you want here]]
- [[more]]
- [[more]]
- [[more]]

## Reference
- Use @x, @y files if you want to take reference on how I write POM code

## Steps
- First fetch the context from 'get-context' tool, until it returns no elements remaining
- Based on context and user functionality, write code in POM format, encapsulating high level functionality into reusable functions
- Try executing code using 'execute-code' tool. You could be on any page, so make sure to navigate to the correct page
- Write spec file using those reusable functions, covering multiple scenarios
`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'create-testcase',
  {
    title: 'Create Testcase',
    description: 'Create a new testcase with iterative development workflow',
    argsSchema: {},
  },
  () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `# Create New Testcase - Iterative Development Workflow

## Goal
Create a comprehensive testcase by building and validating code iteratively. Test each step before moving to the next.

## Prerequisites
1. **URL**: User must provide the platform URL to test
2. **Auth/Login Info**: Search the user's codebase for login credentials, auth patterns, or existing test data based on user's description
3. **Test Objective**: Clear description of what functionality to test

## Workflow
Follow this iterative approach - validate each step before proceeding:

### Step 1: Initialize & Navigate
- Use \`init-browser\` with the provided URL
- Take a screenshot to confirm page loaded correctly

### Step 2: Discover Interactive Elements  
- Use \`get-interactive-snapshot\` to see all clickable/interactive elements
- Identify auth-related elements (login buttons, forms, etc.)

### Step 3: Build Code Incrementally
For each interaction needed:
- Write small code snippet for ONE action (click, fill, etc.)
- Use \`execute-code\` to test the snippet immediately
- If it works, add to your growing test code
- If it fails, debug and fix before moving on
- Take screenshots after major actions to verify state

### Step 4: Handle Authentication
- Look for login forms, auth buttons, or existing session handling
- Use codebase patterns if found, otherwise build step-by-step
- Validate each auth step works before proceeding

### Step 5: Test Core Functionality
- Continue iterative approach: write → test → validate → accumulate
- Use \`get-interactive-snapshot\` whenever you need to see current page state
- If you don't get element here, call \`get-full-snapshot\` but try to avoid it because it's too large generally
- Build up your working test code piece by piece

### Step 6: Create Final Test Structure
- Organize all working code snippets into a complete test
- Add proper assertions and error handling
- Include setup and cleanup steps

## Key Principles
- **Test EVERY code snippet** before adding to final test
- **Never assume** - always verify with \`execute-code\` 
- **Build incrementally** - one working step at a time
- **Use snapshots** to understand current page state
- **Accumulate working code** as you validate each piece

## Expected Output
A complete, tested Playwright testcase that successfully achieves the user's testing objective.`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'debug-testcase',
  {
    title: 'Debug Testcase',
    description: 'Debug and fix an existing testcase',
    argsSchema: {},
  },
  () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `# Debug Existing Testcase

## Goal  
Fix a failing testcase by identifying issues and applying targeted fixes using iterative testing.

## Prerequisites
1. **Testcase Code**: User provides the failing test code
2. **Error Description**: What's failing or expected vs actual behavior
3. **Platform URL**: Where the test should run

## Workflow

### Step 1: Understand the Failure
- Review the provided testcase code
- Understand what it's supposed to do vs what's happening
- Identify the specific failure point

### Step 2: Set Up Environment
- Use \`init-browser\` to navigate to the test URL
- Take initial screenshot to see current state

### Step 3: Execute and Locate Failure Point
- Run the existing testcase using \`execute-code\`
- Note exactly where it fails (line/step)
- Use \`get-interactive-snapshot\` to see current page state at failure point
- If you don't get element here, call \`get-full-snapshot\` but try to avoid it because it's too large generally

### Step 4: Incremental Debugging
For the failing section:
- Break down the failing part into smaller steps
- Test each small step with \`execute-code\`
- Use snapshots to understand page state changes
- Identify root cause (element not found, wrong selector, timing issue, etc.)

### Step 5: Apply Targeted Fixes
- Fix the specific issue (update selectors, add waits, etc.)
- Test the fix in isolation with \`execute-code\`
- Verify it works before integrating back

### Step 6: Test Complete Flow  
- Run the entire fixed testcase to ensure no regressions
- Verify all steps work end-to-end
- Take screenshots at key points to confirm expected behavior

## Common Debug Patterns
- **Selector Issues**: Use \`get-interactive-snapshot\` to find correct selectors
- **Timing Issues**: Add proper waits and verify element visibility
- **Page State**: Check if page state changed (new UI, different flow)
- **Auth Problems**: Verify login/session handling still works

## Expected Output
A corrected testcase that passes all steps and achieves the original testing objective.`,
          },
        },
      ],
    };
  }
);

server.tool(
  'init-browser',
  'Initialize a browser with a URL',
  {
    url: z.string().url().describe('The URL to navigate to'),
  },
  async ({ url }) => {
    capture({
      event: 'init_browser',
      properties: {
        url,
      },
    });

    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }

    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    });
    context = await browser.newContext({
      viewport: null,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      bypassCSP: true,
    });
    page = await context.newPage();

    await page.exposeFunction('takeScreenshot', async (selector: string) => {
      try {
        const screenshot = await page.locator(selector).screenshot({
          timeout: 5000,
        });
        return screenshot.toString('base64');
      } catch (error) {
        console.error('Error taking screenshot', error);
        return null;
      }
    });

    await page.exposeFunction('executeCode', async (code: string) => {
      const result = await secureEvalAsync(page, code);
      return result;
    });

    await page.goto(url);

    // Inject the Discord button
    await page.addInitScript(`(${injectDiscordButton.toString()})()`);

    return {
      content: [
        {
          type: 'text',
          text: `Browser has been initialized and navigated to ${url}`,
        },
      ],
    };
  }
);

server.tool(
  'get-full-dom',
  'Get the full DOM of the current page. (Deprecated, use get-context instead)',
  {},
  async () => {
    capture({
      event: 'get_full_dom',
    });

    const html = await page.content();
    return {
      content: [
        {
          type: 'text',
          text: html,
        },
      ],
    };
  }
);

server.tool(
  'get-screenshot',
  'Get a screenshot of the current page',
  {},
  async () => {
    capture({
      event: 'get_screenshot',
    });

    const screenshot = await page.screenshot({
      type: 'png',
    });
    return {
      content: [
        {
          type: 'image',
          data: screenshot.toString('base64'),
          mimeType: 'image/png',
        },
      ],
    };
  }
);

server.tool(
  'execute-code',
  'Execute custom Playwright JS code against the current page',
  {
    code: z.string()
      .describe(`The Playwright code to execute. Must be an async function declaration that takes a page parameter.

Example:
async function run(page) {
  console.log(await page.title());
  return await page.title();
}

Returns an object with:
- result: The return value from your function
- logs: Array of console logs from execution
- errors: Array of any errors encountered

Example response:
{"result": "Google", "logs": ["[log] Google"], "errors": []}`),
  },
  async ({ code }) => {
    capture({
      event: 'execute_code',
      properties: {
        code: code.length > 1000 ? code.substring(0, 1000) + '...' : code,
        codeLength: code.length,
        pageUrl: page.url(),
      },
    });

    const result = await secureEvalAsync(page, code);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2), // Pretty print the JSON
        },
      ],
    };
  }
);

server.tool(
  'get-interactive-snapshot',
  'Get a snapshot focused on interactive elements (buttons, links, inputs) with annotated screenshot for UI automation',
  {},
  async () => {
    capture({
      event: 'get_interactive_snapshot',
    });

    try {
      const snapshot = await createSnapshot(page);

      return {
        content: [
          {
            type: 'text',
            text: `# Interactive Elements Snapshot\n\nURL: ${snapshot.url}\nTitle: ${snapshot.title}\n\n## Interactive Elements Tree\n\n${snapshot.semanticTree}`,
          },
          {
            type: 'image',
            data: snapshot.screenshot,
            mimeType: 'image/png',
          },
          {
            type: 'text',
            text: `## Label Mapping\n\n${JSON.stringify(snapshot.labelMapping, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating interactive snapshot: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

server.tool(
  'get-full-snapshot',
  'Get a complete snapshot of the page including all visible content (text, images, forms, etc.) for understanding the full context',
  {},
  async () => {
    capture({
      event: 'get_full_snapshot',
    });

    try {
      const snapshot = await createFullSnapshot(page);

      return {
        content: [
          {
            type: 'text',
            text: `# Full Page Snapshot\n\nURL: ${snapshot.url}\nTitle: ${snapshot.title}\n\n## Complete Page Structure\n\n${snapshot.semanticTree}`,
          },
          {
            type: 'image',
            data: snapshot.screenshot,
            mimeType: 'image/png',
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating full snapshot: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

server.tool(
  'get-text-snapshot',
  'Get all text content from the page (headings, paragraphs, lists) for reading and content extraction',
  {},
  async () => {
    capture({
      event: 'get_text_snapshot',
    });

    try {
      const snapshot = await createTextSnapshot(page);

      return {
        content: [
          {
            type: 'text',
            text: `# Text Content Snapshot\n\nURL: ${snapshot.url}\nTitle: ${snapshot.title}\n\n## Page Text Content\n\n${snapshot.semanticTree}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating text snapshot: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

export { server };
