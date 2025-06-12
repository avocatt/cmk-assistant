# CMK Asistanı - Full Stack Project

This repository contains the full stack for the CMK Asistanı, a RAG-powered Q&A application for Turkish lawyers specializing in CMK law. It includes a Python/FastAPI backend and a React Native mobile application.

---

## Backend

The backend is a high-performance API built with Python and FastAPI that serves the RAG model and provides a secure endpoint for audio transcription.

**For setup and usage instructions, see the sections below.**

### 🚀 Deployment

The backend is configured for easy deployment on [Render](https://render.com/). For a complete step-by-step guide, please see:

**[➡️ DEPLOYMENT.md](./DEPLOYMENT.md)**

### Local Development

**Technology Stack:**
- **Backend:** Python, FastAPI
- **RAG Framework:** LangChain
- **LLM:** Configurable via OpenRouter (e.g., Google Gemini, OpenAI GPT-4)
- **Vector Store:** ChromaDB (local)
- **PDF Parsing:** PyPDF

#### Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-name>
    ```

2.  **Create a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Set up environment variables:**
    -   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    -   Edit the `.env` file and add your API keys:
        -   `OPENROUTER_API_KEY`: Your OpenRouter API key for the RAG model.
        -   `OPENAI_API_KEY`: Your OpenAI API key for the secure audio transcription endpoint.
        -   Optionally change the `MODEL_NAME`.

5.  **Add Knowledge Base Documents:**
    -   Place your PDF files (`.pdf`) inside the `data/` directory.

#### Running the Backend

There are two main steps to run the backend application.

##### 1. Ingest Data

You must first process your PDF documents and store them in the vector database. This only needs to be done once, or whenever your source documents change.

```bash
python scripts/ingest.py
```

This will create a `chroma_db` directory containing your vector store.

##### 2. Run the API Server

Once the data is ingested, you can start the web server.

```bash
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`. You can access the auto-generated documentation at `http://127.0.0.1:8000/docs`.

#### API Usage

Send a `POST` request to the `/api/chat` endpoint with a JSON body like this:

```json
{
  "question": "17 yaşındaki bir sanık için müdafi zorunlu mu?"
}
```

The API will return a response with the answer and the sources it used.

---

## Mobile App (iOS & Android)

A cross-platform mobile application built with React Native (Expo) that provides a voice-first chat interface to interact with the backend.

**For setup and usage instructions, see the [mobile app's README](./mobile-app/README.md).** 