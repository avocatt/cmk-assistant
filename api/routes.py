from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from .models import ChatRequest, ChatResponse, Source
from core.rag_service import RAGService
import httpx
import os
import json
from typing import List, AsyncGenerator

router = APIRouter()


async def stream_rag_response(rag_service: RAGService, question: str) -> AsyncGenerator[str, None]:
    """
    A generator that yields the RAG response as a stream of JSON objects.
    The first object is the sources, subsequent objects are answer chunks.
    """
    # 1. Get source documents first
    source_documents = rag_service.get_source_documents(question)
    source_docs_json = [doc.dict() for doc in source_documents]

    # Yield sources as the first part of the stream
    yield f"data: {json.dumps({'sources': source_docs_json})}\n\n"

    # 2. Format context and get the streaming answer
    context = rag_service.format_docs(source_documents)
    answer_stream = rag_service.get_streaming_answer(question, context)

    # 3. Stream the answer chunks
    for chunk in answer_stream:
        yield f"data: {json.dumps({'answer_chunk': chunk})}\n\n"


@router.post("/chat")
async def chat_with_rag(
    chat_request: ChatRequest,
    request: Request
):
    """
    Receives a question, gets an answer from the RAG service, and returns it
    as a Server-Sent Events (SSE) stream.
    """
    if not chat_request.question:
        raise HTTPException(
            status_code=400, detail="Question cannot be empty.")

    rag_service: RAGService = request.app.state.rag_service
    if not rag_service:
        raise HTTPException(
            status_code=503, detail="RAG service is not available.")

    try:
        return StreamingResponse(
            stream_rag_response(rag_service, chat_request.question),
            media_type="text/event-stream"
        )
    except Exception as e:
        # For production, you'd want more specific error handling and logging
        raise HTTPException(
            status_code=500, detail=f"Error processing request: {e}")


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
        # Read the uploaded file
        audio_data = await file.read()

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

        # Make request to OpenAI Whisper API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://api.openai.com/v1/audio/transcriptions',
                files=files,
                data=data,
                headers=headers,
                timeout=30.0
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Transcription failed: {response.text}"
            )

        result = response.json()
        return {"text": result.get("text", "")}

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Transcription request timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error transcribing audio: {str(e)}"
        )
