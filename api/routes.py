from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from .models import ChatRequest, ChatResponse, Source
from core.rag_service import RAGService
from core.cost_tracker import cost_tracker
import httpx
import os
import json
import time
from typing import List, AsyncGenerator

router = APIRouter()


async def stream_rag_response(rag_service: RAGService, question: str, request_id: str = None) -> AsyncGenerator[str, None]:
    """
    A generator that yields the RAG response as a stream of JSON objects.
    The first object is the sources, subsequent objects are answer chunks.
    """
    # 1. Get source documents first
    source_documents = rag_service.get_source_documents(question)
    source_docs_json = [doc.dict() for doc in source_documents]

    # Track embedding cost for retrieval
    if request_id:
        rag_service.track_embedding_cost(request_id, len(question))

    # Yield sources as the first part of the stream
    yield f"data: {json.dumps({'sources': source_docs_json})}\n\n"

    # 2. Format context and get the streaming answer
    context = rag_service.format_docs(source_documents)
    answer_stream = rag_service.get_streaming_answer(
        question, context, request_id)

    # 3. Stream the answer chunks
    for chunk in answer_stream:
        yield f"data: {json.dumps({'answer_chunk': chunk})}\n\n"


@router.post("/chat")
async def chat_with_rag(
    chat_request: ChatRequest,
    request: Request
):
    """
    Receives a question, gets an answer from the RAG service, and returns 
    a complete response with sources and answer.
    """
    if not chat_request.question:
        raise HTTPException(
            status_code=400, detail="Question cannot be empty.")

    rag_service: RAGService = request.app.state.rag_service
    if not rag_service:
        raise HTTPException(
            status_code=503, detail="RAG service is not available.")

    try:
        # Get the request ID for cost tracking
        request_id = getattr(request.state, 'cost_tracking_id', None)

        # Get source documents
        source_documents = rag_service.get_source_documents(
            chat_request.question)

        # Track embedding cost for retrieval
        if request_id:
            rag_service.track_embedding_cost(
                request_id, len(chat_request.question))

        # Convert to Source objects
        sources = [
            Source(
                source_document=doc.metadata.get("source", "N/A"),
                page=doc.metadata.get("page", -1),
                content=doc.page_content,
            )
            for doc in source_documents
        ]

        # Get the complete answer
        context = rag_service.format_docs(source_documents)
        answer = rag_service.get_answer(
            chat_request.question, context, request_id)

        return ChatResponse(
            answer=answer,
            sources=sources
        )
    except Exception as e:
        # For production, you'd want more specific error handling and logging
        raise HTTPException(
            status_code=500, detail=f"Error processing request: {e}")


@router.post("/chat/stream")
async def chat_with_rag_stream(
    chat_request: ChatRequest,
    request: Request
):
    """
    Receives a question and returns a streaming response with sources and answer chunks.
    """
    if not chat_request.question:
        raise HTTPException(
            status_code=400, detail="Question cannot be empty.")

    rag_service: RAGService = request.app.state.rag_service
    if not rag_service:
        raise HTTPException(
            status_code=503, detail="RAG service is not available.")

    try:
        # Get the request ID for cost tracking
        request_id = getattr(request.state, 'cost_tracking_id', None)

        return StreamingResponse(
            stream_rag_response(
                rag_service, chat_request.question, request_id),
            media_type="text/plain"
        )
    except Exception as e:
        # For production, you'd want more specific error handling and logging
        raise HTTPException(
            status_code=500, detail=f"Error processing streaming request: {e}")


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Securely transcribe audio using OpenAI Whisper API.
    This keeps the OpenAI API key secure on the server side.
    """

    # Validate file type
    if not file.content_type or not file.content_type.startswith('audio/'):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an audio file."
        )

    # Get OpenAI API key from environment
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key not configured on server"
        )

    try:
        # Get the request ID for cost tracking
        request_id = getattr(request.state, 'cost_tracking_id', None)

        # Read the uploaded file
        audio_data = await file.read()

        # Estimate audio duration (rough approximation based on file size)
        # This is a rough estimate - for more accuracy, you'd need to analyze the audio
        audio_duration_minutes = len(
            audio_data) / (1024 * 1024 * 2)  # Rough estimate

        # Prepare the request to OpenAI Whisper API
        files = {
            'file': (file.filename, audio_data, file.content_type)
        }
        data = {
            'model': 'whisper-1',
            'language': 'tr'  # Turkish language for better accuracy
        }
        headers = {
            'Authorization': f'Bearer {openai_api_key}'
        }

        # Track the API call timing
        start_time = time.time()

        # Make request to OpenAI Whisper API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://api.openai.com/v1/audio/transcriptions',
                files=files,
                data=data,
                headers=headers,
                timeout=30.0
            )

        duration_ms = int((time.time() - start_time) * 1000)

        if response.status_code != 200:
            # Track failed API call
            if request_id:
                cost_tracker.track_openai_call(
                    request_id=request_id,
                    model='whisper-1',
                    endpoint='audio/transcriptions',
                    audio_duration_minutes=audio_duration_minutes,
                    success=False,
                    error_message=f"HTTP {response.status_code}: {response.text}",
                    duration_ms=duration_ms
                )
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Transcription failed: {response.text}"
            )

        result = response.json()

        # Track successful API call
        if request_id:
            cost_tracker.track_openai_call(
                request_id=request_id,
                model='whisper-1',
                endpoint='audio/transcriptions',
                audio_duration_minutes=audio_duration_minutes,
                success=True,
                duration_ms=duration_ms
            )

        return {"text": result.get("text", "")}

    except httpx.TimeoutException:
        # Track timeout error
        if request_id:
            cost_tracker.track_openai_call(
                request_id=request_id,
                model='whisper-1',
                endpoint='audio/transcriptions',
                audio_duration_minutes=audio_duration_minutes,
                success=False,
                error_message="Request timeout",
                duration_ms=30000  # 30 second timeout
            )
        raise HTTPException(
            status_code=504,
            detail="Transcription request timed out"
        )
    except Exception as e:
        # Track general error
        if request_id:
            cost_tracker.track_openai_call(
                request_id=request_id,
                model='whisper-1',
                endpoint='audio/transcriptions',
                audio_duration_minutes=audio_duration_minutes,
                success=False,
                error_message=str(e),
                duration_ms=int((time.time() - start_time) *
                                1000) if 'start_time' in locals() else 0
            )
        raise HTTPException(
            status_code=500,
            detail=f"Error transcribing audio: {str(e)}"
        )


@router.get("/costs/today")
async def get_today_costs():
    """Get total costs for today across all services"""
    return cost_tracker.get_total_costs_today()


@router.get("/costs/recent")
async def get_recent_requests(limit: int = 50):
    """Get recent request cost summaries"""
    if limit > 100:
        limit = 100  # Cap at 100 for performance
    return {
        "requests": cost_tracker.get_recent_requests(limit),
        "limit": limit
    }


@router.get("/costs/request/{request_id}")
async def get_request_costs(request_id: str):
    """Get detailed cost breakdown for a specific request"""
    request_summary = cost_tracker.get_request_summary(request_id)
    if not request_summary:
        raise HTTPException(
            status_code=404,
            detail="Request not found"
        )

    return {
        "request_id": request_summary.request_id,
        "endpoint": request_summary.endpoint,
        "user_ip": request_summary.user_ip,
        "start_time": request_summary.start_time.isoformat(),
        "end_time": request_summary.end_time.isoformat() if request_summary.end_time else None,
        "total_cost": request_summary.total_cost,
        "total_input_tokens": request_summary.total_input_tokens,
        "total_output_tokens": request_summary.total_output_tokens,
        "success": request_summary.success,
        "error_message": request_summary.error_message,
        "api_calls": [
            {
                "service": call.service,
                "endpoint": call.endpoint,
                "model": call.model,
                "input_tokens": call.input_tokens,
                "output_tokens": call.output_tokens,
                "cost": call.cost,
                "timestamp": call.timestamp.isoformat(),
                "duration_ms": call.duration_ms,
                "success": call.success,
                "error_message": call.error_message
            }
            for call in request_summary.api_calls
        ]
    }
