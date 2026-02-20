# Deadrop Cron Setup Guide

## Overview

Automated inbox checking ensures agents receive messages promptly without manual intervention. This guide shows how to configure OpenClaw cron jobs to poll Deadrop inboxes at regular intervals.

## Prerequisites

Before setting up automated inbox checking:

1. **OpenClaw Gateway Running**: Ensure OpenClaw gateway is active with cron functionality enabled
2. **Deadrop Installed**: CLI should be available in PATH (`deadrop --help` should work)
3. **Database Initialized**: At least one message sent/received to create database schema
4. **Agent Names Defined**: Know which agents need automated checking

## Quick Start

For immediate setup, use Deadrop's built-in cron configuration commands:

```bash
# Generate cron configuration for an agent
deadrop setup-cron --agent ralph --interval 10

# Copy the JSON output and paste into OpenClaw cron interface
```

## Setup Steps

### Step 1: Generate Cron Configuration

Use Deadrop's setup command to generate OpenClaw-compatible cron job configurations:

```bash
# Default 10-minute interval
deadrop setup-cron --agent ralph

# Custom interval (15 minutes)
deadrop setup-cron --agent cody --interval 15

# Example output:
{
  "action": "create",
  "type": "cron",
  "agent": "ralph",
  "command": "deadrop check --agent ralph",
  "interval": "10m",
  "description": "Deadrop inbox checking for agent ralph",
  "enabled": true
}
```

### Step 2: Add to OpenClaw Cron System

Copy the generated JSON and add it to OpenClaw's cron job configuration:

```javascript
// In OpenClaw cron interface or config file
await cron({
  action: "add",
  job: {
    sessionTarget: "isolated",
    schedule: {
      kind: "every",
      everyMs: 600000 // 10 minutes
    },
    payload: {
      kind: "systemEvent",
      text: "deadrop check --agent ralph"
    },
    delivery: {
      mode: "announce",
      channel: "dev-channel"
    }
  }
});
```

### Step 3: Verify Setup

Test the cron job configuration:

```bash
# Manual test - should show new messages if any
deadrop check --agent ralph

# Check OpenClaw cron job status
openclaw status | grep cron

# Monitor agent activity logs
tail -f ~/.openclaw/logs/agent-ralph.log
```

## Configuration Examples

### Basic Agent Monitoring

```bash
# Set up core agents with default 10-minute polling
deadrop setup-cron --agent ralph    # Coding agent
deadrop setup-cron --agent cody     # Dev manager  
deadrop setup-cron --agent scout    # Info gatherer
deadrop setup-cron --agent penny    # Finance tracker
```

### High-Priority Agent (Faster Polling)

```bash
# Critical agents might need faster response times
deadrop setup-cron --agent larry --interval 5

# Generates configuration for 5-minute intervals
{
  "action": "create",
  "type": "cron",
  "agent": "larry",
  "command": "deadrop check --agent larry",
  "interval": "5m",
  "description": "Deadrop inbox checking for agent larry",
  "enabled": true
}
```

### Background Agents (Slower Polling)

```bash
# Less critical agents can poll less frequently
deadrop setup-cron --agent sage --interval 30

# Generates 30-minute polling configuration
{
  "action": "create",
  "type": "cron",
  "agent": "sage", 
  "command": "deadrop check --agent sage",
  "interval": "30m",
  "description": "Deadrop inbox checking for agent sage",
  "enabled": true
}
```

## Advanced Configuration

### Environment-Specific Settings

For different environments, adjust polling intervals based on workload:

```bash
# Production (conservative)
deadrop setup-cron --agent ralph --interval 15

# Development (responsive)
deadrop setup-cron --agent ralph --interval 5

# Testing (minimal)
deadrop setup-cron --agent ralph --interval 60
```

### Multiple Agent Setup Script

Create a script to configure multiple agents:

```bash
#!/bin/bash
# setup-all-agents.sh

agents=("ralph" "cody" "scout" "penny" "sage" "larry")
intervals=(10 15 10 20 30 5)  # Customized intervals per agent

for i in "${!agents[@]}"; do
  agent="${agents[$i]}"
  interval="${intervals[$i]}"
  
  echo "Setting up cron for $agent (${interval}m interval)"
  deadrop setup-cron --agent "$agent" --interval "$interval"
  echo "---"
done
```

### Custom Database Location

If using a custom database location:

```bash
# Set environment variable before setup
export DEADROP_DB="/custom/path/deadrop.sqlite"
deadrop setup-cron --agent ralph --interval 10
```

## OpenClaw Integration Patterns

### Using OpenClaw Cron API

Instead of manual configuration, use OpenClaw's cron API programmatically:

```javascript
// Automated cron job setup
async function setupAgentCrons() {
  const agents = [
    { name: 'ralph', interval: 10 },
    { name: 'cody', interval: 15 },
    { name: 'scout', interval: 10 },
    { name: 'larry', interval: 5 }
  ];
  
  for (const agent of agents) {
    await cron({
      action: "add",
      job: {
        name: `deadrop-${agent.name}`,
        sessionTarget: "isolated",
        schedule: {
          kind: "every",
          everyMs: agent.interval * 60 * 1000 // Convert minutes to ms
        },
        payload: {
          kind: "systemEvent",
          text: `deadrop check --agent ${agent.name}`
        }
      }
    });
  }
}
```

### Conditional Cron Jobs

Set up cron jobs that only run under certain conditions:

```javascript
// Only check inbox during business hours
await cron({
  action: "add",
  job: {
    name: "deadrop-business-hours",
    sessionTarget: "isolated", 
    schedule: {
      kind: "cron",
      expr: "*/10 9-17 * * MON-FRI", // Every 10 min, 9-5, weekdays
      tz: "America/New_York"
    },
    payload: {
      kind: "systemEvent", 
      text: "deadrop check --agent ralph"
    }
  }
});
```

## Removing Cron Jobs

When agents are decommissioned or intervals need changing:

```bash
# Generate removal configuration
deadrop remove-cron --agent old-agent

# Example output:
{
  "action": "delete",
  "type": "cron", 
  "agent": "old-agent",
  "pattern": "deadrop check --agent old-agent",
  "description": "Remove Deadrop cron job for agent old-agent"
}
```

Then apply the removal in OpenClaw:

```javascript
await cron({
  action: "remove",
  jobId: "deadrop-old-agent" // or use pattern matching
});
```

## Monitoring and Troubleshooting

### Verifying Cron Jobs Are Running

```bash
# Check OpenClaw cron job status
openclaw status | grep -A 5 -B 5 deadrop

# View recent cron job executions
journalctl -u openclaw-gateway --since "1 hour ago" | grep deadrop

# Check agent logs for inbox activity
tail -f ~/.openclaw/logs/agent-ralph.log | grep "📬\|📭"
```

### Performance Monitoring

Monitor database performance with frequent polling:

```bash
# Check database size
ls -lh ~/.openclaw/workspace/deadrop.sqlite

# Monitor database locks (if using multiple agents)
lsof ~/.openclaw/workspace/deadrop.sqlite

# Check message throughput
sqlite3 ~/.openclaw/workspace/deadrop.sqlite "SELECT COUNT(*) as total_messages, COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread FROM messages;"
```

### Common Issues and Solutions

**Cron Jobs Not Executing**
```bash
# Check OpenClaw cron scheduler status
openclaw status

# Verify agent session is available
openclaw sessions list | grep ralph

# Test manual execution
deadrop check --agent ralph
```

**Database Lock Errors**
```bash
# If multiple agents cause lock contention, stagger intervals
deadrop setup-cron --agent ralph --interval 10
deadrop setup-cron --agent cody --interval 12  # Offset by 2 minutes
```

**High Resource Usage**
```bash
# Reduce polling frequency for less critical agents
deadrop setup-cron --agent background-agent --interval 30

# Monitor system resources
top -p $(pgrep openclaw)
```

## Best Practices

### Polling Interval Guidelines

| Agent Priority | Recommended Interval | Use Case |
|----------------|---------------------|-----------|
| Critical (Larry, Ralph) | 5-10 minutes | Task coordination, urgent work |
| Standard (Cody, Scout) | 10-15 minutes | Regular development work |
| Background (Sage, Penny) | 20-30 minutes | Analysis, reporting |
| Archive/Maintenance | 60+ minutes | Cleanup, historical data |

### Resource Management

1. **Stagger Intervals**: Don't poll all agents at the same time
2. **Monitor Database Size**: Implement message cleanup for old messages
3. **Use Appropriate Intervals**: Match polling frequency to agent importance
4. **Test Performance**: Monitor system resources with active polling

### Security Considerations  

1. **Database Permissions**: Ensure only authorized agents can access messages
2. **Log Rotation**: Prevent log files from growing too large
3. **Message Retention**: Implement automatic cleanup of old messages
4. **Access Control**: Restrict cron job modification permissions

### Maintenance Tasks

```bash
# Clean up old messages (older than 30 days)
sqlite3 ~/.openclaw/workspace/deadrop.sqlite "DELETE FROM messages WHERE timestamp < datetime('now', '-30 days');"

# Vacuum database to reclaim space
sqlite3 ~/.openclaw/workspace/deadrop.sqlite "VACUUM;"

# Backup database before major changes
cp ~/.openclaw/workspace/deadrop.sqlite ~/.openclaw/workspace/deadrop.sqlite.backup
```

## Migration and Updates

### Updating Polling Intervals

```bash
# Remove old cron job
deadrop remove-cron --agent ralph

# Add new cron job with updated interval
deadrop setup-cron --agent ralph --interval 15
```

### Bulk Reconfiguration

```bash
#!/bin/bash
# reconfigure-all.sh - Update all agent intervals

agents=("ralph" "cody" "scout" "penny") 
new_interval=12

for agent in "${agents[@]}"; do
  echo "Reconfiguring $agent to ${new_interval}m"
  deadrop remove-cron --agent "$agent"
  deadrop setup-cron --agent "$agent" --interval "$new_interval"
done
```

## Next Steps

- Review the [Integration Guide](integration-guide.md) for communication patterns
- Set up monitoring for cron job execution and performance
- Implement message cleanup policies for database maintenance  
- Configure alerting for failed inbox checks or database issues

## Reference

### Cron Configuration Schema

```json
{
  "action": "create|delete",
  "type": "cron", 
  "agent": "agent-name",
  "command": "deadrop check --agent agent-name",
  "interval": "Nm",  // N minutes
  "pattern": "command-pattern-for-deletion",
  "description": "human-readable description",
  "enabled": true
}
```

### Environment Variables

- `DEADROP_DB`: Path to SQLite database file
- `OPENCLAW_WORKSPACE`: Base workspace directory 
- `NODE_ENV`: Environment (affects default intervals)

### Commands Reference

```bash
deadrop setup-cron --agent <name> [--interval <minutes>]
deadrop remove-cron --agent <name>
deadrop check --agent <name>
deadrop inbox --agent <name> [--unread]
```