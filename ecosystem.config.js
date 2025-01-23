module.exports = {
  apps: [{
    name: "discord-bot",
    script: "/home/pi/discord/index.js",
    wait_ready: true,
    listen_timeout: 50000,
    kill_timeout: 3000,
    restart_delay: 30000,  // 30 second delay on restart
    dependencies: ['network.target']  // Wait for network
  }]
}