# Deadrop Integration Examples

## Replace sessions_send calls

**Before (prone to timeouts):**
```bash
sessions_send "agent:target:discord:channel:123" "Task complete" --timeoutSeconds 60
```

**After (reliable):**
```bash
deadrop send --to target --from $(whoami) --subject "Task Status" --body "Task complete"
```

## Agent workflow integration

### In AGENTS.md heartbeat
```bash
# Check for messages at task boundaries
deadrop check --agent $(whoami)
```

### Sub-agent communication
```bash
# Sub-agent reports to parent
deadrop send --to parent --from subagent --body "Subtask finished successfully"

# Parent checks messages after spawning sub-agents
deadrop check --agent parent
```

### Status updates
```bash
# Deployment notification
deadrop send --to all-agents --from deploy-bot --subject "Deploy Alert" --body "Production deploy starting"

# Task handoff
deadrop send --to cody --from larry --subject "Handoff" --body "Please take over JIRA ticket PROJ-123"
```

## Integration with existing tools

### With Jira updates
```bash
# Notify team after Jira update
jira transition PROJ-123 "Done"
deadrop send --to team-lead --from $(whoami) --subject "PROJ-123" --body "Ticket marked complete"
```

### With GitHub operations
```bash
# Notify after push
git push origin feature/new-feature
deadrop send --to reviewer --from dev --body "Feature branch ready for review"
```

## Monitoring patterns

### Daily digest
```bash
#!/bin/bash
# Add to cron for daily message summary
echo "📬 Daily message summary for $(whoami):" 
deadrop inbox --agent $(whoami) | head -20
```

### Unread count
```bash
# Quick unread check
unread_count=$(deadrop inbox --agent $(whoami) --unread | grep -c "●" || echo "0")
echo "📭 $unread_count unread messages"
```