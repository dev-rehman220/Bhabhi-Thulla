const net = require('node:net');
const { spawn } = require('node:child_process');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}

async function findPort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available web port found between ${startPort} and ${startPort + 99}.`);
}

async function main() {
  const port = await findPort(8081);
  console.log(`Starting get-away web on port ${port}`);
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['--prefix', 'get-away', 'run', 'web', '--', '--port', String(port)], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
