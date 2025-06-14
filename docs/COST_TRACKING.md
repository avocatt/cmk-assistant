# API Cost Tracking

This document explains the API cost tracking system implemented in the CMK Assistant backend.

## Overview

The cost tracking system monitors and logs the costs of all external API calls made by the application, including:

- **OpenRouter API calls** (for LLM responses)
- **OpenAI API calls** (for embeddings and audio transcription)
- Token usage and estimated costs per request

## Features

### 🔍 Request-Level Tracking
- Each HTTP request gets a unique tracking ID
- All API calls within that request are grouped together
- Total cost calculation per request

### 📊 Cost Calculation
- **OpenRouter**: Tracks input/output tokens and calculates costs based on model pricing
- **OpenAI Embeddings**: Estimates token usage and calculates embedding costs
- **OpenAI Whisper**: Tracks audio duration and transcription costs

### 📈 Monitoring Endpoints
- `/api/costs/today` - Get today's total costs and statistics
- `/api/costs/recent` - Get recent request summaries
- `/api/costs/request/{id}` - Get detailed breakdown for a specific request
- `/health` - Health check with cost overview

## API Endpoints

### Get Today's Costs
```http
GET /api/costs/today
```

**Response:**
```json
{
  "date": "2024-01-15",
  "total_cost": 0.012450,
  "total_input_tokens": 2847,
  "total_output_tokens": 156,
  "total_requests": 12,
  "service_breakdown": {
    "openrouter": {
      "cost": 0.011200,
      "input_tokens": 2500,
      "output_tokens": 150,
      "calls": 10
    },
    "openai": {
      "cost": 0.001250,
      "input_tokens": 347,
      "output_tokens": 6,
      "calls": 15
    }
  }
}
```

### Get Recent Requests
```http
GET /api/costs/recent?limit=10
```

**Response:**
```json
{
  "requests": [
    {
      "request_id": "uuid-string",
      "endpoint": "/api/chat",
      "start_time": "2024-01-15T10:30:00Z",
      "end_time": "2024-01-15T10:30:02Z",
      "total_cost": 0.002150,
      "total_input_tokens": 234,
      "total_output_tokens": 45,
      "success": true,
      "api_calls_count": 2
    }
  ],
  "limit": 10
}
```

### Get Request Details
```http
GET /api/costs/request/{request_id}
```

**Response:**
```json
{
  "request_id": "uuid-string",
  "endpoint": "/api/chat",
  "user_ip": "192.168.1.100",
  "start_time": "2024-01-15T10:30:00Z",
  "end_time": "2024-01-15T10:30:02Z",
  "total_cost": 0.002150,
  "total_input_tokens": 234,
  "total_output_tokens": 45,
  "success": true,
  "error_message": null,
  "api_calls": [
    {
      "service": "openai",
      "endpoint": "embeddings",
      "model": "text-embedding-ada-002",
      "input_tokens": 59,
      "output_tokens": 0,
      "cost": 0.000006,
      "timestamp": "2024-01-15T10:30:00Z",
      "duration_ms": 120,
      "success": true,
      "error_message": null
    },
    {
      "service": "openrouter",
      "endpoint": "chat/completions",
      "model": "anthropic/claude-3.5-sonnet",
      "input_tokens": 175,
      "output_tokens": 45,
      "cost": 0.002144,
      "timestamp": "2024-01-15T10:30:01Z",
      "duration_ms": 1850,
      "success": true,
      "error_message": null
    }
  ]
}
```

## Implementation Details

### Cost Tracking Components

1. **CostTracker** (`core/cost_tracker.py`)
   - Central cost tracking service
   - Maintains pricing tables for different models
   - Stores request summaries and API call details

2. **CostTrackingMiddleware** (`core/middleware.py`)
   - FastAPI middleware that wraps every request
   - Creates tracking ID and logs request summary
   - Prints cost summary to console

3. **LLM Wrapper** (`core/llm_wrapper.py`)
   - Extended ChatOpenAI class with cost tracking
   - LangChain callback handler for token usage
   - Automatic cost calculation for LLM calls

4. **RAG Service Integration** (`core/rag_service.py`)
   - Updated to use cost-tracking LLM
   - Tracks embedding costs for retrieval
   - Passes request ID through call chain

### Pricing Tables

The system includes built-in pricing for popular models:

**OpenAI Models:**
- GPT-4o: $0.0025/$0.01 per 1K input/output tokens
- GPT-4o-mini: $0.00015/$0.0006 per 1K input/output tokens
- Whisper-1: $0.006 per minute
- Text embeddings: $0.0001-$0.00013 per 1K tokens

**OpenRouter Models:**
- Claude 3.5 Sonnet: $0.003/$0.015 per 1K input/output tokens
- Claude 3 Haiku: $0.00025/$0.00125 per 1K input/output tokens
- Llama models: Various pricing

> **Note:** OpenRouter has dynamic pricing. Update the pricing table periodically or fetch from OpenRouter's API.

## Console Logging

Each request prints a detailed cost summary:

```
=== REQUEST COST SUMMARY ===
Request ID: 550e8400-e29b-41d4-a716-446655440000
Endpoint: /api/chat
Duration: 2341ms
Total Cost: $0.002150
Input Tokens: 234
Output Tokens: 45
API Calls: 2
  Call 1: openai/text-embedding-ada-002 - $0.000006
  Call 2: openrouter/anthropic/claude-3.5-sonnet - $0.002144
Success: True
=== END COST SUMMARY ===
```

## Testing

Run the included test script to verify cost tracking:

```bash
python test_cost_tracking.py
```

The test will:
1. Make a chat request
2. Verify costs are tracked
3. Check cost endpoints
4. Display results

## Configuration

### Environment Variables

Make sure these are set in your `.env` file:

```env
OPENROUTER_API_KEY=your_openrouter_key
OPENAI_API_KEY=your_openai_key
MODEL_NAME=anthropic/claude-3.5-sonnet
```

### Updating Pricing

To update pricing tables, modify the `OPENAI_PRICING` and `OPENROUTER_PRICING` dictionaries in `core/cost_tracker.py`.

For real-time pricing from OpenRouter:
```python
# You could fetch pricing from OpenRouter API
import httpx

async def fetch_openrouter_pricing():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://openrouter.ai/api/v1/models")
        # Parse and update pricing
```

## Memory Management

- Only the last 1000 completed requests are kept in memory
- Older requests are automatically purged
- For production, consider persisting data to a database

## Security Considerations

- Cost endpoints don't require authentication (add if needed)
- Request IDs are UUIDs (not sequential for security)
- API keys are never logged or exposed
- User IPs are optionally tracked

## Future Enhancements

- [ ] Database persistence for historical data
- [ ] Cost alerts and budgets
- [ ] Real-time pricing updates
- [ ] Cost optimization suggestions
- [ ] Export to CSV/Excel
- [ ] Dashboard UI for cost visualization 