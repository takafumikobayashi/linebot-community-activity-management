# Deployment Guide

This guide walks through deploying the Community Activity Management System for your organization.

## Prerequisites

1. **Google Account** with Apps Script access
2. **LINE Developers Account** and Messaging API channel
3. **OpenAI API Account** with API key
4. **kintone Account** (optional, for event management)
5. **Google Spreadsheet** for data storage

## Setup Steps

### 1. Clone and Prepare

```bash
git clone <repository-url>
cd community-activity-bot
npm install
```

### 2. Configure Environment

Create script properties in Google Apps Script:

#### Required Configuration

```bash
# LINE API
CHANNEL_ACCESS_TOKEN=your_line_token

# OpenAI API
OPENAI_API_KEY=your_openai_key

# Google Spreadsheet
SPREADSHEET_ID=your_spreadsheet_id

# kintone (if using)
KINTONE_DOMAIN=your_domain
KINTONE_EVENT_APP_ID=your_app_id
KINTONE_EVENT_API_TOKEN=your_token
```

#### Organization Customization

```bash
# Customize for your organization
ORGANIZATION_NAME=あなたの組織名
ACTIVITY_TYPE=活動の種類
FAQ_TRIGGER_PHRASE=教えて

# Optional settings
SIMILARITY_THRESHOLD=0.75
FAQ_SINGLE_WORD_TRIGGERS=["持ち物","場所","時間"]
FALLBACK_IMAGES=["https://example.com/image1.jpg"]
```

### 3. Environment Setup (Multi-Environment Support)

This project supports three environments: development (dev), staging (stg), and production (prod).

#### Create Environment-Specific GAS Projects

1. **Development Environment**: Use existing project or create new one
2. **Staging Environment**: Create new project at [Google Apps Script](https://script.google.com/)
3. **Production Environment**: Create new project at [Google Apps Script](https://script.google.com/)

#### Configure Script IDs

Copy template files and set actual script IDs:

```bash
# Copy templates to actual config files
cp .clasp.dev.json.template .clasp.dev.json
cp .clasp.stg.json.template .clasp.stg.json
cp .clasp.prod.json.template .clasp.prod.json

# Edit each file with your actual script ID
# Example: .clasp.dev.json
{
  "scriptId": "1dVoVXw-kS2V2x_99cIdYVZkpeeUbKyi7yGIAb91M9pOtQWc-mtia2KQZ",
  "rootDir": "dist"
}
```

**Security Note**: All `.clasp.*.json` files are gitignored and managed locally only.

### 4. Prepare Google Spreadsheet

Create a spreadsheet with these sheets:

- **FAQ**: Questions, answers, and embeddings
- **Log**: Conversation history
- **Users**: User management
- **Event**: Event data (synced from kintone)
- **Participation**: RSVP records

### 5. Deploy to Google Apps Script

```bash
# Development environment (default)
npm run deploy        # or npm run deploy:dev

# Staging environment
npm run deploy:stg

# Production environment
npm run deploy:prod
```

**How it works**: Each command builds the project and uses the corresponding `.clasp.*.json` file for deployment.

### 6. Configure LINE Webhook

1. Go to LINE Developers Console
2. Set webhook URL to your deployed GAS URL
3. Enable webhook usage
4. Test with a simple message

### 7. Initialize FAQ Data

```bash
# Generate embeddings for existing FAQ content
# Run this once after deployment
```

## Environment-Specific Configuration

Each environment should have separate configuration values in Google Apps Script's Script Properties:

### Development Environment

```bash
# Script Properties for development
SPREADSHEET_ID=dev_spreadsheet_id
CHANNEL_ACCESS_TOKEN=dev_line_token
ORGANIZATION_NAME=テスト組織
ACTIVITY_TYPE=テスト活動

# Deploy
npm run deploy:dev
```

### Staging Environment

```bash
# Script Properties for staging
SPREADSHEET_ID=stg_spreadsheet_id
CHANNEL_ACCESS_TOKEN=stg_line_token
KINTONE_DOMAIN=stg_kintone_domain
ORGANIZATION_NAME=ステージング組織
ACTIVITY_TYPE=ステージング活動

# Deploy
npm run deploy:stg
```

### Production Environment

```bash
# Script Properties for production
SPREADSHEET_ID=prod_spreadsheet_id
CHANNEL_ACCESS_TOKEN=prod_line_token
KINTONE_DOMAIN=prod_kintone_domain
ORGANIZATION_NAME=本番組織名
ACTIVITY_TYPE=本番活動

# Deploy
npm run deploy:prod
```

**Important**: Each environment should use:

- Separate Google Spreadsheets
- Different LINE channels (or separate webhook URLs)
- Isolated kintone environments
- Environment-appropriate organization settings

## Verification

### 1. Basic Functionality Test

Send these test messages to your LINE bot:

```bash
# Welcome message test
(Add bot as friend)

# FAQ test
{ORGANIZATION_NAME}{FAQ_TRIGGER_PHRASE} テスト

# RSVP test
参加します

# Schedule inquiry
今後の予定
```

### 2. Configuration Verification

Verify these elements use your custom configuration:

- Welcome message includes your organization name
- FAQ responses mention your activity type
- Monthly schedules use your activity terminology
- AI responses reflect your organization context

### 3. Error Handling Test

Test edge cases:

- Invalid date formats
- Unknown commands
- Network errors
- API rate limits

## Monitoring and Maintenance

### 1. Log Monitoring

Monitor these logs in Google Apps Script:

- API call errors
- Processing failures
- User interaction patterns

### 2. Performance Monitoring

Track:

- Response times
- API usage
- Memory consumption
- Error rates

### 3. Regular Maintenance

Monthly tasks:

- Review FAQ effectiveness
- Update fallback images
- Clean old conversation logs
- Verify API quotas

## Troubleshooting

### Environment Setup Issues

1. **clasp login required**

   ```bash
   clasp login
   ```

2. **Permission errors during deployment**

   ```bash
   Solution: Ensure you have owner or editor access to the GAS project
   Check project settings in Google Apps Script console
   ```

3. **Script ID not found**

   ```bash
   1. Open Google Apps Script project
   2. Get ID from URL: https://script.google.com/home/projects/{SCRIPT_ID}/edit
   3. Update corresponding .clasp.*.json file
   ```

4. **Wrong environment deployed**

   ```bash
   Check: Verify which .clasp.json file is being used
   Solution: Use specific deploy command (npm run deploy:dev/stg/prod)
   ```

### Common Deployment Issues

1. **Apps Script Execution Errors**

   ```bash
   Solution: Check script properties are set correctly
   ```

2. **LINE Webhook Not Working**

   ```bash
   Solution: Verify webhook URL and SSL certificate
   ```

3. **OpenAI API Errors**

   ```bash
   Solution: Check API key and quota limits
   ```

4. **Spreadsheet Permission Errors**

   ```bash
   Solution: Grant Apps Script access to spreadsheet
   ```

### Configuration Issues

1. **Wrong Organization Name in Messages**

   ```bash
   Check: ORGANIZATION_NAME in script properties
   Action: Redeploy after fixing
   ```

2. **FAQ Trigger Not Working**

   ```bash
   Check: ORGANIZATION_NAME + FAQ_TRIGGER_PHRASE combination
   Test: Send exact trigger phrase
   ```

3. **Activity Type Not Updated**

   ```bash
   Check: ACTIVITY_TYPE in script properties
   Clear: Apps Script cache if needed
   ```

## Security Considerations

### 1. API Key Management

- Store all API keys in script properties (encrypted)
- Never commit keys to version control
- Rotate keys regularly
- Use least-privilege access

### 2. Data Protection

- Implement conversation log cleanup
- Anonymize user data when possible
- Follow data retention policies
- Secure spreadsheet access

### 3. Access Control

- Limit script editor access
- Use environment-specific deployments
- Monitor unusual activity
- Implement error handling for sensitive operations

## Scaling Considerations

### 1. User Load

- Monitor concurrent user limits
- Implement rate limiting if needed
- Consider caching strategies
- Plan for peak usage periods

### 2. Data Growth

- Implement log rotation
- Archive old data
- Monitor spreadsheet size limits
- Consider database migration for large scale

### 3. API Limits

- Monitor OpenAI usage
- Implement fallback responses
- Cache frequent requests
- Consider multiple API keys for high volume

## Rollback Procedures

### 1. Emergency Rollback

```bash
# Revert to previous version
npm run deploy:prod -- --version=previous

# Or disable bot temporarily
# (Disable webhook in LINE console)
```

### 2. Configuration Rollback

```bash
# Restore previous script properties
# Redeploy with old configuration
npm run deploy:prod
```

### 3. Data Recovery

- Keep backups of critical spreadsheets
- Maintain FAQ content backups
- Document configuration changes
- Test rollback procedures regularly
