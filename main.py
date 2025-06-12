from fastapi import FastAPI
from contextlib import asynccontextmanager
from api.routes import router as api_router
from core.rag_service import get_rag_chain


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    print("Application startup: Initializing RAG service...")
    try:
        # Load the RAG chain and store it in the application state
        app.state.rag_service = get_rag_chain()
        print("RAG service initialized successfully.")
    except Exception as e:
        # If initialization fails, log the error and set the service to None
        print(f"FATAL: RAG service failed to initialize: {e}")
        app.state.rag_service = None

    yield

    # --- Shutdown ---
    print("Application shutdown.")
    # You can add cleanup code here if needed
    app.state.rag_service = None


app = FastAPI(
    title="CMK Asistanı API",
    version="0.1.0",
    description="API for the CMK Asistanı RAG application.",
    lifespan=lifespan
)

app.include_router(api_router, prefix="/api")


@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the CMK Asistanı API. See /docs for usage."}

# This is useful if you want to run the app directly with `python main.py`
# But for development, `uvicorn main:app --reload` is preferred.
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
