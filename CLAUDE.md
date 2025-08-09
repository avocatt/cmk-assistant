# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CMK-Assistant is a full-stack application providing AI-powered legal assistance for Turkish lawyers specializing in CMK (Criminal Procedure Code) law. It consists of:

1. **Backend**: FastAPI server with RAG (Retrieval-Augmented Generation) using LangChain, ChromaDB, and OpenRouter/OpenAI
2. **Mobile App**: React Native (Expo) application for iOS/Android with voice-first interface

## Development Commands

### Backend Development

```bash
# Setup virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Ingest PDF documents into vector database (required before running server)
python scripts/ingest.py

# Run development server
uvicorn main:app --reload

# Run cost tracking test
python test_cost_tracking.py
```

### Mobile App Development

```bash
cd mobile-app

# Install dependencies
npm install

# Start Expo development server
npm start

# Platform-specific commands
npm run ios      # Start iOS simulator
npm run android  # Start Android emulator
npm run web      # Start web version
```

## Architecture Overview

### Backend Architecture

The backend follows a layered architecture with clear separation of concerns:

- **FastAPI Application** (`main.py`): Entry point with lifespan management and middleware
- **API Layer** (`api/`): Routes handling HTTP requests/responses
- **Core Layer** (`core/`): Business logic including:
  - `rag_service.py`: RAG implementation with ChromaDB vector store
  - `llm_wrapper.py`: Cost-tracking wrapper for LangChain LLM
  - `cost_tracker.py`: Comprehensive API cost tracking system
  - `config.py`: Environment-based configuration
- **Data Processing** (`scripts/ingest.py`): Document chunking strategies for legal texts

Key patterns:
- **Dependency Injection**: Services stored in `app.state` and injected into routes
- **Middleware Pattern**: Cost tracking and request logging
- **Streaming Responses**: Server-sent events for real-time chat responses

### Mobile App Architecture

React Native app with TypeScript:

- **Service Layer** (`src/services/`): API communication and storage abstractions
- **Component Architecture**: Reusable UI components with TypeScript
- **Chat Management**: Multi-session support with AsyncStorage persistence
- **Migration System**: Handles data structure evolution

### RAG Implementation

1. **Document Processing**:
   - Different strategies for statutes (article-based) vs guidebooks (recursive splitting)
   - Batch processing to stay within API token limits
   
2. **Retrieval & Generation**:
   - Vector store: ChromaDB with OpenAI embeddings
   - LLM: Configurable via OpenRouter (default: Google Gemini Pro)
   - Turkish-language prompts for legal expertise

## Key Integration Points

1. **API Endpoints**:
   - `/api/chat`: Main Q&A endpoint
   - `/api/chat/stream`: Streaming responses
   - `/api/transcribe`: Audio transcription
   - `/api/costs/*`: Cost tracking endpoints

2. **Environment Configuration**:
   - Backend: `.env` file with `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `MODEL_NAME`
   - Mobile: `.env` file with `EXPO_PUBLIC_API_URL`

3. **Cost Tracking**:
   - Automatic tracking of all API calls
   - Per-request cost summaries in console
   - Monitoring endpoints for usage analysis

## Important Considerations

1. **Data Ingestion**: Always run `python scripts/ingest.py` after adding new PDFs to the `data/` directory
2. **Mobile Development**: Use computer's network IP (not localhost) for `EXPO_PUBLIC_API_URL` when testing on physical devices
3. **API Keys**: All API keys stay server-side; mobile app communicates through backend proxy
4. **Turkish Language**: System is optimized for Turkish legal language - prompts and responses are in Turkish
5. **Legal Context**: This is a legal assistance tool specifically for CMK (Criminal Procedure Code) law in Turkey