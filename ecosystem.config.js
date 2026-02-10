module.exports = {
  apps: [
    // Main Next.js application
    {
      name: "wb-reputation",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/var/www/wb-reputation",
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      error_file: "/var/www/wb-reputation/logs/error.log",
      out_file: "/var/www/wb-reputation/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_memory_restart: "1G",
      watch: false
    },

    // Telegram Bot process (long-polling, separate from main app)
    {
      name: "wb-reputation-tg-bot",
      script: "scripts/start-telegram-bot.js",
      cwd: "/var/www/wb-reputation",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/var/www/wb-reputation/logs/tg-bot-error.log",
      out_file: "/var/www/wb-reputation/logs/tg-bot-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      watch: false
    },

    // Cron jobs process (separate from main app)
    {
      name: "wb-reputation-cron",
      script: "scripts/start-cron.js",
      cwd: "/var/www/wb-reputation",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/var/www/wb-reputation/logs/cron-error.log",
      out_file: "/var/www/wb-reputation/logs/cron-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      watch: false
    }
  ]
};
