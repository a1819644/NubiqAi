// PM2 Ecosystem Configuration for Production

module.exports = {
  apps: [
    {
      name: 'nubiqai-backend',
      script: 'index.ts',
      interpreter: 'npx',
      interpreter_args: 'ts-node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      time: true
    }
  ]
};
