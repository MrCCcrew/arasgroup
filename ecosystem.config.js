// PM2 Process Manager Configuration
// Usage: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name: "arasgroup",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/arasgroup.app",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "/var/log/pm2/arasgroup-error.log",
      out_file: "/var/log/pm2/arasgroup-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
