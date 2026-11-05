# How to Use playwright-mcp?

[![npm version](https://img.shields.io/npm/v/playwright-mcp)](https://www.npmjs.com/package/playwright-mcp) [![Docs](https://img.shields.io/badge/docs-playwright--mcp-blue)](https://ashish-bansal.github.io/playwright-mcp/)

## Introduction

Ever tried using Cursor or Claude to write Playwright tests? Yeah, it's kind of a mess.

Why? Because your AI assistant has no clue what's on your web page. It's like trying to describe a painting to someone who's blindfolded. The result?

- **Flaky tests** → The AI is guessing selectors, and it gets them wrong.
- **Broken scripts** → You spend more time fixing tests than writing them.
- **Debugging nightmares** → The AI can't "see" what's happening, so you end up doing all the heavy lifting.

Wouldn't it be nice if your AI could actually understand your web page instead of just making educated guesses?

### Enter playwright-mcp !

`playwright-mcp` gives your AI assistant superpowers by making the browser fully visible to it. Instead of working in the dark, your AI assistant now has real-time access to the page DOM, elements, and interactions.

### How playwright-mcp Works (AKA How We Fix This Mess)

Once installed, playwright-mcp spins up a Playwright-controlled browser and gives your AI assistant full access to it. This unlocks:

1. **Recording interactions** → Click, type, scroll—let playwright-mcp turn your actions into fully functional Playwright test cases.
2. **Taking screenshots** → Capture elements or full pages so your AI gets actual visual context (no more guessing).
3. **Extracting the DOM** → Grab the entire HTML structure so the AI can generate rock-solid selectors.
4. **Executing JavaScript** → Run custom JS inside the browser for debugging, automation, or just for fun.

### Why You'll Love playwright-mcp

🚀 **AI-generated tests that actually work** → No more flaky selectors, broken tests, or guesswork.

⏳ **Massive time savings** → Write and debug Playwright tests 5x faster.

🛠️ **Fewer headaches** → Your AI assistant gets live page context, so it can generate real test cases.

🔌 **Works out of the box** → Plug it into Cursor, Claude, WindSurf, or whatever you use—it just works.

#### **Give Your AI the Context It Deserves**

Tired of fixing AI-generated tests? Stop debugging AI's bad guesses—start writing flawless Playwright tests. Use the guide below to install playwright-mcp and let your AI assistant actually help you for once.

---

### Installation: Get Up and Running in No Time

### Prerequisites (a.k.a. What You Need Before You Start)

Before you install `playwright-mcp`, make sure you have:

✅ Node.js installed on your system (because, well… it's an npm package)

✅ Playwright and its Chromium browser installed

✅ An IDE that supports MCP, like Cursor

✅ A brain that's ready to automate Playwright tests like a pro

### Setting Up playwright-mcp (It's Easy, I Promise)

#### Connect It to Your IDE (Cursor Setup)

If you're using Cursor, follow these steps to connect `playwright-mcp` like a boss:

1. Open Cursor IDE
2. Navigate to Settings (⚙️)
3. Select Cursor Settings → Go to the MCP tab
4. Click "Add new MCP server"
5. Fill in the following details:

   ![Connect playwright-mcp to cursor](https://github.com/Ashish-Bansal/playwright-mcp/blob/docs/static/img/cursor-add-mcp.png?raw=true)
   - Name → `playwright-mcp`
   - Command → `npx -y playwright-mcp`

6. Click "Add", and boom—you're connected! 🚀

Note: If clicking on "Add new MCP server", opens a file(.cursor/mcp.json), Paste the following code and save:

```jsx
{
  "mcpServers": {
    "playwright-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "playwright-mcp"
      ]
    }
  }
}
```

Now Cursor actually understands your web pages. No more random test suggestions based on zero context! Head to the [Claude tutorial](https://ashish-bansal.github.io/playwright-mcp/tutorials/claude-desktop-tutorial) or [Cursor tutorial](https://ashish-bansal.github.io/playwright-mcp/tutorials/cursor-tutorial) to understand it in details.

---

### **Connect It to Claude desktop**

Wait… Does It Work with Other AI Assistants? Yes! While `playwright-mcp` is a match made in heaven for IDEs, you can use it with Claude desktop to write tests as well.

1. Install `playwright-mcp` (The Easy Part)
   1. First things first, fire up your terminal and run:
   2. `npm install -g playwright-mcp`
2. Hook It Up to Claude Desktop
   1. Find the Configuration File
   2. On windows
      1. `%APPDATA%\Claude\claude_desktop_config.json`
   3. On macOS:
      1. `~/Library/Application Support/Claude/claude_desktop_config.json`
   4. Update the config file

   ```jsx
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": ["-y", "playwright-mcp"]
       }
     }
   }
   ```

3. Restart Claude Desktop (Because It's a New Day)
   1. Close and reopen Claude Desktop to apply the changes.
4. Verify That It's Working
   1. Once everything is set up, let's test if Claude can actually talk to Playwright now.
   2. Open Claude and ask: "List all available MCP tools."
   3. If `playwright-mcp` is installed correctly, it should list tools like:
      1. `init-browser` → Initialize browser and navigate to a URL
      2. `get-interactive-snapshot` → Get focused snapshot of interactive elements (buttons, links, inputs) with annotated screenshot
      3. `get-full-snapshot` → Get complete page snapshot including all visible content for full context understanding
      4. `get-text-snapshot` → Extract all text content from the page for reading and content analysis
      5. `get-screenshot` → Take a simple screenshot of the current page
      6. `get-full-dom` → Get raw HTML DOM (deprecated - use snapshot tools instead)
      7. `execute-code` → Run custom Playwright JavaScript code against the page
   4. Ask Claude to init browser and a browser should open up after your approval!

Now that the Calude has access to the web pages. You can ask it write highly contextual tests! Head to the [Claude tutorial](https://ashish-bansal.github.io/playwright-mcp/tutorials/claude-desktop-tutorial) or [Cursor tutorial](https://ashish-bansal.github.io/playwright-mcp/tutorials/cursor-tutorial) to understand it in details.

[📖 **View Documentation**](https://ashish-bansal.github.io/playwright-mcp/)
