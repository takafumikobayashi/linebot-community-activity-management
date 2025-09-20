# API Reference

This document provides detailed API specifications for the Community Activity Management System.

## Configuration API

### Organization Configuration

```typescript
interface OrganizationConfig {
  name: string;           // Organization name
  activityType: string;   // Type of activities
  faqTriggerPhrase: string; // FAQ trigger phrase
}

function getOrganizationConfig(): OrganizationConfig
```

**Environment Variables:**

- `ORGANIZATION_NAME`: Default "コミュニティ"
- `ACTIVITY_TYPE`: Default "活動"
- `FAQ_TRIGGER_PHRASE`: Default "教えて"

### Conversation Context Configuration

```typescript
interface ConversationContextConfig {
  maxConversationPairs: number;  // Default: 7
  maxContextHours: number;       // Default: 24
}

function getConversationContextConfig(): ConversationContextConfig
```

**Environment Variables:**

- `MAX_CONVERSATION_PAIRS`: Maximum conversation exchanges to reference (default: 7)
- `MAX_CONTEXT_HOURS`: Time window for conversation history in hours (default: 24)

### Message Templates

```typescript
interface MessageTemplates {
  welcome: string;
  monthlyScheduleHeader: (month: number) => string;
  faqPrompt: string;
  systemPrompt: string;
}

function getMessageTemplates(config: OrganizationConfig): MessageTemplates
```

> ✅ Coverage: `__tests__/config.prompts.test.ts` verifies that customized organization settings propagate to every template (welcome text, monthly header, prompts, system message).

## LINE Messaging API

### Core Functions

#### Message Sending

```typescript
// Basic text message
function replyMessage(replyToken: string, text: string): void

// Enhanced message with optional image
function pushMessageWithImage(
  userId: string,
  text: string,
  imageUrl?: string
): void

// RSVP confirmation with image support
function pushConfirmParticipationWithImage(
  userId: string,
  text: string,
  eventRecordId: string,
  imageUrl?: string
): void

// Multicast messaging (up to 150 users)
function multicastMessages(
  userIds: string[],
  messages: LineMessage[]
): void
```

#### Template Messages

```typescript
// Carousel template for monthly schedules
interface CarouselColumn {
  title: string;
  text: string;
  thumbnailImageUrl?: string;
  imageBackgroundColor?: string;
  actions: MessageAction[];
}

// Confirm template for RSVP
interface ConfirmTemplate {
  text: string;
  actions: [
    { type: "message", label: string, text: string },
    { type: "message", label: string, text: string }
  ];
}
```

### Event Processing

```typescript
// Main event router
function routeEvent(event: LineEvent): void

// Event type handlers
function handleMessageEvent(event: LineEvent): void
function handleFollowEvent(event: LineEvent): void
function handlePostbackEvent(event: LineEvent): void
```

## FAQ System API

### Core Functions

```typescript
// Main FAQ handler
function handleFaq(
  replyToken: string,
  userMessage: string,
  userId: string
): void

// Similarity search
function findBestFaqMatch(
  questionEmbedding: number[],
  threshold: number = 0.75
): SearchResult | null

// Embedding generation
function getEmbedding(text: string): Promise<number[]>
```

### Data Structures

```typescript
interface SearchResult {
  question: string;
  answer: string;
  similarity: number;
  rowIndex: number;
}

interface FaqData {
  question: string;
  answer: string;
  embedding: number[];
}
```

## RSVP System API

### Core Functions

```typescript
// RSVP processing with date
function handleRsvpWithDate(
  replyToken: string,
  userId: string,
  eventDate: string,
  status: 'yes' | 'no'
): void

// Fixed phrase RSVP
function handleRsvpBySpecifiedDate(
  replyToken: string,
  userId: string,
  eventDate: string,
  status: 'yes' | 'no'
): void

// Atomic RSVP recording
function recordRSVPInEvent(
  eventRecordId: string,
  userId: string,
  status: string
): RSVPResult
```

### Date Parsing

```typescript
// Parse date from user message
function parseRsvpWithDate(message: string): DateRsvpMatch | null

interface DateRsvpMatch {
  date: string;    // Format: "YYYY/MM/DD"
  status: 'yes' | 'no';
}

// Flexible date format support
// Examples: "9/15", "9月15日", "9/15(日)", "2025/09/15"
```

### RSVP Status Codes

```typescript
type RSVPResult =
  | 'added'              // Successfully added
  | 'removed'            // Successfully removed
  | 'already_registered' // Already participating
  | 'already_absent'     // Already marked absent
  | 'not_found'          // Event not found
  | 'full'               // Event at capacity
  | 'cancelled'          // Event cancelled
  | 'error'              // Processing error
```

## Scheduled Tasks API

### Monthly Schedule Distribution

```typescript
// Main scheduling function
function sendMonthlySchedule(): void

// Individual components
function getEventsFromKintone(): KintoneEvent[]
function saveEventsToSheet(events: KintoneEvent[]): void
function getEventsForMonth(year: number, month: number): EventData[]
```

### Reminder System

```typescript
// Event reminders
function sendEventReminders(): void

// Thank you messages
function sendThankYouMessages(): void

// Image selection for events
function selectImageForEvent(
  eventImageUrl: string | null,
  eventRecordId: string
): string | null
```

## Data Management API

### Spreadsheet Operations

```typescript
// Event data
function getEventsForDate(targetDate: string): EventData[]
function getUpcomingEvents(limit: number): EventData[]

// User management
function saveNewUser(userId: string): void
function getAllUserIds(): string[]

// Conversation logging
function writeLog(
  userId: string,
  userMessage: string,
  botResponse: string
): void

// Enhanced conversation retrieval with time filtering
function getRecentConversationForUser(
  userId: string,
  limitPairs: number = 7,
  maxHours: number = 24
): Array<{ role: 'user' | 'assistant'; content: string }>

// Conversation context configuration
function getConversationContextConfig(): {
  maxConversationPairs: number;
  maxContextHours: number;
}
```

### Data Structures

```typescript
interface EventData {
  開催日: string;      // Date in YYYY/MM/DD format
  開始時間: string;    // Start time
  終了時間: string;    // End time
  イベント名: string;  // Event name
  recordId: string;   // Unique identifier
  画像URL?: string;   // Optional image URL
}

interface ConversationEntry {
  timestamp: Date;
  userId: string;
  userMessage: string;
  botResponse: string;
}
```

## OpenAI Integration API

### Embedding Functions

```typescript
// Generate embedding for text
function getEmbedding(text: string): Promise<number[]>

// Batch embedding generation
function batchGenerateEmbeddings(texts: string[]): Promise<number[][]>

// Similarity calculation
function calculateCosineSimilarity(
  vectorA: number[],
  vectorB: number[]
): number
```

### Chat Completion

```typescript
// Simple chat
function generateSimpleChat(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 200,
  temperature: number = 0.3
): string

// Chat with history (enhanced with time filtering)
function generateChatWithHistory(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentMessage: string,
  maxTokens: number = 200,
  temperature: number = 0.3
): string
```

### Prompt Generation

```typescript
// FAQ-specific prompts
function createFaqPrompt(
  userQuestion: string,
  faqQuestion: string,
  faqAnswer: string
): string

// Chat prompts
function createChatPrompt(userMessage: string): string

function createChatPromptWithHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): string
```

## Error Handling

### Standard Error Responses

```typescript
// Error handling pattern
try {
  // Operation
} catch (error) {
  console.error('[Component] Error description:', error);
  // Graceful fallback
}
```

### Common Error Types

- **API Rate Limits**: OpenAI/LINE API quotas exceeded
- **Data Access Errors**: Spreadsheet permission issues
- **Processing Timeouts**: GAS execution limits
- **Invalid Input**: Malformed user messages

## Rate Limiting & Quotas

### Google Apps Script Limits

- **Execution Time**: 6 minutes maximum
- **Trigger Quota**: 20 triggers per script
- **URL Fetch**: 20,000 calls per day

### External API Limits

- **OpenAI**: Model-specific rate limits
- **LINE Messaging**: 1000 messages per hour (free tier)
- **Google Spreadsheet**: 100 requests per 100 seconds

### Best Practices

- Implement exponential backoff for retries
- Use batch operations when possible
- Cache frequently accessed data
- Monitor quota usage proactively

## Testing API

### Mock Configuration

```typescript
// Test environment setup
beforeEach(() => {
  global.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (key: string) => mockConfig[key] || null
    })
  };
});
```

### Test Utilities

```typescript
// Create test LINE events
function createLineMessageEvent(text: string): LineEvent
function createLineFollowEvent(userId: string): LineEvent
function createLinePostbackEvent(data: string): LineEvent

// Mock external services
const mockUrlFetchApp = jest.fn();
const mockSpreadsheetApp = jest.fn();
const mockUtilities = jest.fn();
```

## Migration API

### Configuration Migration

```typescript
// Migrate from hardcoded to configurable
function migrateOrganizationConfig(
  oldName: string,
  newConfig: OrganizationConfig
): void

// Update existing FAQ data
function migrateFaqContent(
  oldOrgName: string,
  newOrgName: string
): void
```

This API reference provides the foundation for extending and customizing the Community Activity Management System for your organization's specific needs.
