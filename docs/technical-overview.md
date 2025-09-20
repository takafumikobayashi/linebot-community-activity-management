# Technical Overview

This document provides technical details about the Community Activity Management System architecture and implementation.

## System Architecture

### Overview

The system is built as a serverless chatbot application using:

- **Platform**: Google Apps Script (GAS)
- **Chat Interface**: LINE Messaging API
- **AI Services**: OpenAI API (GPT-4o-mini, text-embedding-3-small)
- **Data Storage**: Google Spreadsheet + kintone integration
- **Development**: TypeScript with Jest testing framework

### Core Components

```json
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LINE Platform │    │  Google Apps    │    │   External      │
│                 │    │    Script       │    │   Services      │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Webhook   │ │───▶│ │   Router    │ │───▶│ │   OpenAI    │ │
│ │  Endpoint   │ │    │ │             │ │    │ │     API     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ ┌─────────────┐ │    │ │  Handlers   │ │    │ │   kintone   │ │
│ │  Messaging  │ │◀───│ │             │ │───▶│ │     API     │ │
│ │     API     │ │    │ └─────────────┘ │    │ └─────────────┘ │
│ └─────────────┘ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
└─────────────────┘    │ │   Sheet     │ │───▶│ │   Google    │ │
                       │ │  Services   │ │    │ │ Spreadsheet │ │
                       │ └─────────────┘ │    │ └─────────────┘ │
                       └─────────────────┘    └─────────────────┘
```

## API Design

### LINE Messaging API Integration

#### Webhook Endpoint

- **Function**: `doPost(e)` (Google Apps Script Web App)
- **Supported Events**: message, follow, postback
- **Security**: X-Line-Signature verification

#### Message Processing Flow

1. **Event Routing** (`src/router.ts`)
   - FAQ trigger detection (configurable phrases)
   - Date-specific RSVP parsing
   - Fixed-phrase RSVP detection
   - Schedule inquiry handling
   - Chat fallback

2. **Response Generation**
   - Template-based responses
   - AI-generated answers (FAQ/chat)
   - Rich messages (carousels, confirmations)

#### Message Types Supported

- Text messages
- Template messages (carousel, confirm)
- Quick reply buttons
- Postback actions

### OpenAI API Integration

#### Embedding Generation

- **Model**: text-embedding-3-small
- **Usage**: FAQ similarity search
- **Batch Processing**: Multiple FAQ items at once

#### Chat Completion

- **Model**: GPT-4o-mini
- **Features**:
  - Context-aware responses
  - Conversation history (max 7 exchanges, 24 hours, configurable)
  - Time-based conversation filtering
  - Organization-specific prompts

### Data Management

#### Google Spreadsheet Structure

- **FAQ Sheet**: Questions, answers, embeddings
- **Log Sheet**: Conversation history (time-filtered, max 7 exchanges)
- **Users Sheet**: User registration data
- **Event Sheet**: Activity events (synced from kintone)
- **Participation Sheet**: RSVP records

#### kintone Integration

- **Purpose**: Event management system
- **Sync**: One-way from kintone to spreadsheet
- **Frequency**: Monthly (automated)

## Core Features Implementation

### 1. FAQ System

```typescript
// Configurable trigger detection
function isFaqTrigger(message: string): boolean {
  const config = getOrganizationConfig();
  const pattern = getFaqTriggerPattern(config);
  return pattern.test(message.trim());
}

// Similarity-based matching
const similarity = calculateCosineSimilarity(questionEmbedding, faqEmbedding);
if (similarity >= threshold) {
  // Return FAQ answer
}
```

### 2. RSVP System

```typescript
// Date-specific parsing
const dateMatch = parseRsvpWithDate(message);
// "9/15(日) 参加します" → { date: "2025/09/15", status: "yes" }

// Atomic updates with lock service
function recordRSVPInEvent(eventRecordId: string, userId: string, status: string) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Update both Event sheet and Participation log
  } finally {
    lock.releaseLock();
  }
}
```

### 3. Message Templates

```typescript
// Organization-configurable templates
function getMessageTemplates(config: OrganizationConfig): MessageTemplates {
  return {
    welcome: `友達追加ありがとうございます！
ここでは${config.activityType}に関する質問に答えたり...`,
    monthlyScheduleHeader: (month: number) =>
      `📅 ${month}月の${config.activityType}予定です！`,
    // ...
  };
}
```

## Testing Strategy

### Test Coverage

- **Total Tests**: 220 tests across 10 test suites
- **Coverage Target**: 90%+
- **Test Types**: Unit, Integration, E2E

### Test Categories

1. **Unit Tests**: Individual function testing
2. **Integration Tests**: API interaction testing
3. **E2E Tests**: Full workflow testing
4. **Mock Strategy**: All external APIs mocked

### Key Test Areas

- Message routing logic
- RSVP parsing and processing
- FAQ similarity matching
- Conversation context management (NEW)
- Template generation (`__tests__/config.prompts.test.ts`)
- Error handling (`__tests__/main.test.ts` for GAS entrypoints)
- Image fallback determinism (`__tests__/scheduled.test.ts`)

### Conversation Context System (NEW)

```typescript
// Time-based conversation filtering
function getRecentConversationForUser(
  userId: string,
  limitPairs: number = 7,
  maxHours: number = 24
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Filter conversations within time window
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - maxHours);

  // Retrieve and process conversation history
  // ...
}

// Configurable context settings
function getConversationContextConfig(): {
  maxConversationPairs: number;
  maxContextHours: number;
} {
  return {
    maxConversationPairs: getEnvVar('MAX_CONVERSATION_PAIRS', 7),
    maxContextHours: getEnvVar('MAX_CONTEXT_HOURS', 24),
  };
}
```

## Performance Considerations

### Limitations

- **Google Apps Script**: 6-minute execution limit
- **Spreadsheet**: Performance degrades with large datasets
- **OpenAI API**: Rate limiting considerations
- **Memory**: Limited GAS memory allocation

### Optimization Strategies

- **Batch Processing**: Multiple operations in single execution
- **Caching**: FAQ embeddings cached in spreadsheet
- **Pagination**: Large datasets processed in chunks
- **Conversation History**: Limited to 200 rows read per query
- **Time Filtering**: Only process conversations within configured time window
- **Error Recovery**: Graceful degradation on failures

## Security

### Data Protection

- **API Keys**: Stored in Script Properties (encrypted)
- **User Data**: Minimal PII collection
- **Conversation Logs**: Automatic cleanup (configurable retention)

### Access Control

- **LINE Webhook**: Signature verification
- **Spreadsheet**: Service account permissions
- **kintone**: API token-based authentication

### Input Validation

- **Message Content**: Length and format validation
- **Date Parsing**: Robust date format handling
- **SQL Injection**: Not applicable (no SQL database)

## Deployment

### Environment Management

- **Development**: Separate GAS project
- **Staging**: Pre-production testing environment
- **Production**: Live system with monitoring

### Configuration Management

- **Script Properties**: Environment-specific settings
- **Version Control**: Git-based source control
- **Build Process**: TypeScript compilation + bundling

### Monitoring

- **Execution Logs**: Google Apps Script console
- **Error Tracking**: Exception logging
- **Performance**: Execution time monitoring

## Scalability Considerations

### Current Limits

- **Concurrent Users**: ~150 per multicast batch
- **Message Volume**: Limited by GAS quotas
- **Data Size**: Spreadsheet row limits (~5M cells)

### Scaling Options

1. **Horizontal**: Multiple GAS projects
2. **Migration**: Move to dedicated infrastructure
3. **Optimization**: Improve algorithm efficiency
4. **Caching**: External caching layer

## Development Guidelines

### Code Organization

```bash
src/
├── handlers/     # Feature-specific logic
├── services/     # External service integrations
├── utils/        # Utility functions
└── types/        # TypeScript type definitions
```

### Best Practices

- **Type Safety**: Strict TypeScript configuration
- **Error Handling**: Comprehensive try-catch blocks
- **Logging**: Structured console logging
- **Testing**: Test-driven development approach

### Configuration System

- All organization-specific content externalized
- Environment variable-based configuration
- Template system for message generation
- Regex pattern generation for flexible matching
