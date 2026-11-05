import http from 'http';
import fs from 'fs';
import path from 'path';
import url, { fileURLToPath } from 'url';
import { dirname } from 'path';
import net from 'net';

// Get the current file's path
const __filename = fileURLToPath(import.meta.url);
// Get the current directory
const __dirname = dirname(__filename);

// Define the directory from which to serve files
const SERVE_DIR = path.join(__dirname, 'ui'); // Change 'public' to your desired directory name

// Helper function to check if port is in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const tester = net
      .createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.once('close', () => resolve(false));
        tester.close();
      })
      .listen(port);
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Parse URL to get the file path
  const parsedUrl = url.parse(req.url || '');
  const pathname = parsedUrl.pathname || '/';

  // Resolve to absolute path within SERVE_DIR only
  let filePath = path.join(SERVE_DIR, pathname);

  // Security check: ensure the file path is within SERVE_DIR
  if (!filePath.startsWith(SERVE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Access denied');
    return;
  }

  // If path ends with '/', serve index.html from that directory
  if (pathname.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err) {
      // File not found
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // If it's a directory, attempt to serve index.html
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, (err, stats) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        serveFile(filePath, res);
      });
    } else {
      // It's a file, serve it
      serveFile(filePath, res);
    }
  });
});

// Helper function to serve a file
function serveFile(filePath: string, res: http.ServerResponse): void {
  // Get file extension to set correct content type
  const ext = path.extname(filePath);
  let contentType = 'text/plain';

  switch (ext) {
    case '.html':
      contentType = 'text/html';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.js':
      contentType = 'application/javascript';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
    case '.gif':
      contentType = 'image/gif';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
    case '.pdf':
      contentType = 'application/pdf';
      break;
  }

  // Read and serve the file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

export { server as webServer, isPortInUse };
