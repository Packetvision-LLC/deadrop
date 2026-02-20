# Deadrop
*Dead drops for AI agents*

Deadrop is a persistent message queue for OpenClaw agents inspired by spy dead drops. When real-time agent communication fails due to timeouts or busy sessions, Deadrop ensures your messages get through.

## Features

✅ **Persistent messaging** - messages survive session restarts  
✅ **SQLite durability** - reliable local storage  
✅ **CLI-first design** - simple command interface  
✅ **Cross-session compatible** - works across agent restarts  
✅ **ACK protocol** - acknowledgment system for reliability  
✅ **Fallback reliability** - when direct communication fails  

## Installation

```bash
npm install -g deadrop
```

## Quick Start

### Send a message
```bash
deadrop send --to cody --from larry --subject "Task Update" --body "Kraken deployment is complete"
```

### Check for new messages
```bash
deadrop check --agent cody
```

Output:
```
📬 1 new message(s):

[1] From: larry
Subject: Task Update  
Time: 2026-02-20T09:15:00Z
Message: Kraken deployment is complete
---
```

### View inbox history
```bash
# All messages
deadrop inbox --agent cody

# Unread only  
deadrop inbox --agent cody --unread
```

## CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `send` | Send a message to another agent | `deadrop send --to ralph --from cody --body "New task available"` |
| `check` | Check for new messages (marks as read) | `deadrop check --agent ralph` |
| `inbox` | List all messages in agent's inbox | `deadrop inbox --agent ralph --unread` |
| `setup-cron` | Generate cron job configuration | `deadrop setup-cron --agent ralph --interval 10` |
| `remove-cron` | Generate cron job removal config | `deadrop remove-cron --agent ralph` |

### Advanced Usage

**Custom database location:**
```bash
export DEADROP_DB=/path/to/your/deadrop.sqlite
deadrop send --to agent --from sender --body "message"
```

**Integration with OpenClaw cron:**
```bash
# Generate cron configuration
deadrop setup-cron --agent ralph --interval 10

# Copy JSON output to OpenClaw cron jobs
```

**Acknowledgment protocol:**
```bash
# Send acknowledgment for message ID 42
deadrop send --to sender --from recipient --subject "ACK:42" --body "Message processed"
```

## Architecture

Deadrop uses SQLite as a persistent message store, enabling reliable agent communication even when direct `sessions_send` calls fail. Messages are stored with timestamps and read status, allowing agents to process messages at their own pace.

The system is designed as a fallback mechanism: agents should attempt direct communication first, then use Deadrop for guaranteed delivery. Automated inbox checking via OpenClaw cron jobs ensures timely message processing without manual intervention.

## Integration Patterns

### Fallback Communication
```javascript
// Try direct communication first
try {
  await sessions_send(targetAgent, message, {timeout: 15000});
} catch (error) {
  // Fallback to Deadrop
  await exec(`deadrop send --to ${targetAgent} --from ${currentAgent} --body "${message}"`);
}
```

### Automated Inbox Checking
```bash
# Set up automated polling every 10 minutes
deadrop setup-cron --agent ralph --interval 10
```

For detailed integration examples and patterns, see the [documentation](docs/) folder.

## Contributing

We welcome contributions! Please see our [contributing guidelines](CONTRIBUTING.md) for details on:

- Code style and formatting
- Testing requirements  
- Pull request process
- Issue reporting

## License

MIT - see [LICENSE](LICENSE) file for details.

## Links

- **Documentation**: [docs/](docs/) - Integration guides and setup instructions
- **Issues**: [GitHub Issues](https://github.com/Packetvision-LLC/deadrop/issues)
- **OpenClaw**: Learn more about the [OpenClaw](https://openclaw.ai) agent framework