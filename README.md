# Deadrop 📮

> SQLite-backed message queue for reliable agent-to-agent communication in OpenClaw

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

## Overview

Deadrop solves a common problem in multi-agent systems: **reliable message delivery**. When direct session communication fails due to timeouts, agent downtime, or network issues, important messages can be lost. Deadrop provides a persistent, SQLite-backed message queue that ensures no communication is missed.

### Key Features

- 🔒 **Reliable Delivery**: Messages persist until read, eliminating timeout losses
- 🚀 **Simple CLI**: Easy integration into any agent workflow  
- 🗃️ **SQLite Backend**: Lightweight, no daemon required, atomic operations
- 🔄 **Cross-Agent Compatible**: Works from any agent, sub-agent, or script
- ⚡ **Automated Checking**: OpenClaw cron integration for hands-free operation
- 📝 **Message History**: Complete audit trail of inter-agent communication

## Quick Start

### Installation

```bash
npm install -g deadrop
```

Or clone and install locally:

```bash
git clone https://github.com/Packetvision-LLC/deadrop.git
cd deadrop
npm install
npm link  # Makes `deadrop` available globally
```

### Basic Usage

```bash
# Send a message
deadrop send --to cody --from larry --subject "Task Update" --body "Kraken deployment complete"

# Check for new messages (marks as read)
deadrop check --agent cody

# View message history  
deadrop inbox --agent cody
```

## Architecture

```
┌─────────────┐    timeouts/failures    ┌─────────────┐
│   Agent A   │ ────────────────────────▶│   Agent B   │
│             │                          │   (offline) │
└─────────────┘                          └─────────────┘
       │                                        ▲
       │ fallback to Deadrop                   │ checks when online
       ▼                                       │
┌─────────────┐                          ┌─────────────┐
│  Deadrop    │◀─────────────────────────│   Agent B   │
│  Message    │      reads messages      │  (online)   │
│  Queue      │                          │             │
└─────────────┘                          └─────────────┘
```

## Command Reference

### Send Messages

```bash
# Basic message
deadrop send --to recipient --from sender --body "message content"

# With subject
deadrop send --to cody --from larry --subject "Deploy Status" --body "Production deployment successful"

# Multi-line messages
deadrop send --to team --from bot --body "Line 1
Line 2
Line 3"
```

### Check Messages

```bash
# Check and mark as read
deadrop check --agent cody

# Output example:
# 📬 2 new message(s):
# [1] From: larry
# Subject: Deploy Status  
# Time: 2026-02-16T20:30:00.000Z
# Message: Production deployment successful
# ---
```

### View Inbox

```bash
# All messages
deadrop inbox --agent cody

# Unread only
deadrop inbox --agent cody --unread

# Output shows read status (● = unread, ✓ = read)
```

### Automated Setup

```bash
# Generate OpenClaw cron configuration
deadrop setup-cron --agent cody --interval 10

# Remove automation  
deadrop remove-cron --agent cody
```

## Integration Patterns

### Primary Pattern: Fallback Communication

Use Deadrop as a fallback when direct communication fails:

```bash
# Try sessions_send first, fallback to Deadrop
if ! sessions_send "agent:target:session" "message" --timeoutSeconds 30; then
    deadrop send --to target --from $(whoami) --body "message"  
fi
```

### Agent Workflow Integration

Add to agent startup, heartbeat, or task boundaries:

```bash
#!/bin/bash
# Check messages during agent workflow
deadrop check --agent $(whoami)

# Process any messages found
# ... your message handling logic ...
```

### ACK Convention

Acknowledge important messages:

```bash
# Sender
deadrop send --to cody --from larry --subject "Deploy Request" --body "Please deploy feature-x to production"

# Recipient checks and acknowledges  
deadrop check --agent cody
deadrop send --to larry --from cody --subject "ACK: Deploy Request" --body "Starting production deploy of feature-x"
```

### Sub-Agent Communication

Sub-agents can use Deadrop when sessions_send isn't available:

```bash
# Sub-agent reports to parent
deadrop send --to parent --from sub-agent-123 --subject "Task Complete" --body "Analysis finished: /tmp/results.json"
```

## Configuration

### Database Location
Messages are stored in: `~/.openclaw/workspace/deadrop.sqlite`

### Message Schema
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL, 
  subject TEXT,
  body TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME
);
```

### Environment Variables
- `DEADROP_DB_PATH`: Override default database location
- `DEADROP_DEBUG`: Enable debug logging

## OpenClaw Integration

### Automated Inbox Checking

Set up cron jobs for hands-free operation:

```bash
# Generate cron config
deadrop setup-cron --agent cody --interval 10

# Copy the JSON output and add to OpenClaw:
cron add --job '{"enabled":true,"name":"Deadrop Inbox Check - cody",...}'
```

### Agent Configuration  

Add to your `AGENTS.md`:

```markdown
## Message Checking
- Deadrop inbox checked every 10 minutes via cron  
- Manual check: `deadrop check --agent $(whoami)`
- Important messages require ACK response
```

## Best Practices

### Message Design
```bash
# Good: Clear subject and context
deadrop send --to cody --from larry \
  --subject "Bug Fix: Login timeout #123" \
  --body "GitHub issue #123 affecting 15% users. Priority: High. Fix needed by EOD."

# Bad: Vague messaging  
deadrop send --to cody --from larry --body "fix the bug"
```

### Agent Naming
Use consistent agent names across your deployment:
- `larry` ✓ (not `Larry` or `agent-larry`)
- `cody` ✓ (not `Cody-dev`)

### Message Types

| Type | Subject Format | ACK Required |
|------|----------------|--------------|
| Status Update | `Status: [brief description]` | No |
| Task Request | `Request: [task summary]` | Yes |
| Alert | `Alert: [issue]` | Yes (critical) |
| Handoff | `Handoff: [item/ticket]` | Yes |

### Cleanup

Clean old messages periodically:

```bash
# Remove messages older than 30 days
sqlite3 ~/.openclaw/workspace/deadrop.sqlite \
  "DELETE FROM messages WHERE timestamp < datetime('now', '-30 days');"
```

## Troubleshooting

### Messages Not Appearing
1. Check agent name consistency (`cody` vs `Cody`)
2. Verify database permissions in `~/.openclaw/workspace/`
3. Check for SQLite locking (close other database connections)

### Performance Issues  
1. Clean up old messages: `sqlite3 deadrop.sqlite "DELETE FROM messages WHERE timestamp < datetime('now', '-7 days');"`
2. Monitor database size: `ls -lah ~/.openclaw/workspace/deadrop.sqlite`

### Database Corruption
```bash
# Check database integrity
sqlite3 ~/.openclaw/workspace/deadrop.sqlite "PRAGMA integrity_check;"

# If corrupted, backup and recreate
mv ~/.openclaw/workspace/deadrop.sqlite{,.backup}
# Next deadrop command will recreate the database
```

## Documentation

- [Integration Guide](docs/integration-guide.md) - Detailed integration patterns and protocols
- [Cron Setup Guide](docs/cron-setup.md) - Automated inbox checking configuration

## Development

### Requirements
- Node.js >= 14.0.0
- SQLite3

### Local Development
```bash
git clone https://github.com/Packetvision-LLC/deadrop.git
cd deadrop
npm install

# Run locally
node bin/deadrop.js send --to test --from dev --body "hello world"
```

### Testing
```bash
# Send test message
deadrop send --to test-agent --from test-sender --body "test message"

# Check delivery
deadrop check --agent test-agent

# View inbox
deadrop inbox --agent test-agent
```

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style
- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Follow existing patterns

### Reporting Issues
Please include:
- Operating system and Node.js version
- Complete error messages
- Steps to reproduce
- Expected vs actual behavior

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [OpenClaw](https://github.com/openclaw/openclaw) - Multi-agent AI framework
- [OpenClaw Skills](https://clawhub.com) - Community skills marketplace

---

**Made with ❤️ by [Packetvision LLC](https://github.com/Packetvision-LLC)**