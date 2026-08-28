/* global __dirname */
module.exports = {
  apps: [
    {
      name: "thulla-server",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};