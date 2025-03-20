# Enhanced Event Tracking System

This module implements a comprehensive event tracking system for the agent,
allowing detailed tracking of reminders, PR notifications, system events, and
more. The system is designed for flexibility, analytics, and integration with AI
systems.

## Key Features

- **Hierarchical Event Classification**: Categorize events by both category and
  type for better organization
- **Foreign Key Relationships**: Proper relationships with users, repositories,
  and workflows
- **Context Tracking**: Group related events via contextId and track
  parent-child relationships
- **Event Lifecycle**: Track event status from creation to resolution
- **Flexible Tagging**: Apply multiple tags to events for versatile filtering
- **Priority Levels**: Mark events with priority levels (low, normal, high,
  critical)
- **Environment Support**: Track which environment events originate from
- **Advanced Analytics**: Aggregate and analyze events by various dimensions and
  time periods

## Event Schema

The event table schema includes:

- `id`: Unique identifier for each event
- `eventCategory`: High-level category (NOTIFICATION, ACTIVITY, SYSTEM, etc.)
- `eventType`: Specific event type within category
- `actorId`: User who performed or received the action (foreign key to users
  table)
- `repositoryId`: Related repository (foreign key to repositories table)
- `workflowId`: Related workflow (foreign key to workflows table)
- `eventData`: JSON data specific to the event type
- `metadata`: Additional metadata about the event
- `contextId`: Groups related events together
- `parentEventId`: For hierarchical events (self-reference)
- `status`: Current status in the event lifecycle
- `priority`: Importance level of the event
- `tags`: Array of string tags for flexible categorization
- `environment`: System environment (development, production, etc.)
- `createdAt`, `updatedAt`, `resolvedAt`: Timestamps tracking event lifecycle

## Usage

### Basic Event Logging

```typescript
import { Repository } from './repository'
import { EventCategory, EventType, EventPriority } from './schema'

// Log a notification event with full context
await Repository.logEvent(
  EventCategory.NOTIFICATION,
  EventType.PR_NOTIFIED,
  'org_123',
  {
    message: 'New PR requires review',
    prNumber: 123,
    url: 'https://github.com/org/repo/pull/123',
  },
  {
    metadata: { source: 'pr-service' },
    actorId: 'user_123',
    repositoryId: 'repo_456',
    contextId: 'ctx_pr_123',
    priority: EventPriority.HIGH,
    tags: ['pull-request', 'needs-review', 'urgent'],
    environment: 'production',
  },
)
```

### Using the Event Service

```typescript
import { EventService } from '../services'
import { EventPriority } from '../db/schema'

// Track a reminder with context and tags
await EventService.trackReminderSent(
  'org_123',
  'user_456',
  'PR_REVIEW',
  'Please review PR #123',
  {
    metadata: { priority: 'high' },
    repositoryId: 'repo_789',
    priority: EventPriority.HIGH,
    contextId: 'ctx_pr_123',
    tags: ['reminder', 'urgent'],
  },
)

// Generate a monthly report
const report = await EventService.generateMonthlyReminderReport(
  'org_123',
  3, // March
  2023,
  'repo_456', // Optional repository filter
)

// Generate activity trends
const trends = await EventService.generateActivityTrendsReport(
  'org_123',
  new Date('2023-01-01'),
  new Date('2023-03-31'),
  'week', // Group by week
)

// Find stalled PRs that need a reminder
const stalledPRs = await EventService.findStalledPRsForReminder('org_123', {
  thresholdDays: 3,
  repositories: ['repo_456'],
  excludeTags: ['do-not-remind'],
})

// Mark an event as resolved
await EventService.resolveEvent('event_123')

// Add tags to an event
await EventService.tagEvent('event_123', ['completed', 'verified'])
```

## AI Integration

The enhanced event data provides rich context for AI analysis:

- Generate detailed monthly reports with trend analysis
- Analyze patterns of stalled PRs and suggest interventions
- Identify repositories with frequent issues
- Recommend improvements to workflows and notification systems
- Track event lifecycle and identify bottlenecks
- Generate activity heatmaps by time period

Example AI integration is available in `src/examples/event-tracking-example.ts`
