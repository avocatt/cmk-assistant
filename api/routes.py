from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from .models import ChatRequest, ChatResponse
import httpx
import os

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_with_rag(
    chat_request: ChatRequest,
    request: Request
):
    """
    Receives a question, gets an answer from the RAG service, and returns it.
    The RAG service is initialized at startup and accessed via app state.
    """
    if not chat_request.question:
        raise HTTPException(
            status_code=400, detail="Question cannot be empty.")

    rag_service = request.app.state.rag_service
    if not rag_service:
        raise HTTPException(
            status_code=503, detail="RAG service is not available.")

    try:
        result = rag_service.invoke(chat_request.question)
        return ChatResponse(answer=result["answer"], sources=result["sources"])
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
