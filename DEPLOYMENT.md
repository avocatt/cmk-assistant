# Deploying the Backend to Render

This guide provides step-by-step instructions for deploying the FastAPI backend to [Render](https://render.com/), a cloud platform with a great free tier for projects like this.

## Prerequisites

1.  **GitHub Repository:** Your project code, including the `render.yaml` file, must be in a GitHub repository.
2.  **Render Account:** You will need a free Render account. You can sign up here: [https://dashboard.render.com/register](https://dashboard.render.com/register).

---

## Deployment Steps

### Step 1: Create a New Blueprint Service

1.  Log in to your Render dashboard.
2.  Click the **New +** button and select **Blueprint**.

3.  Connect your GitHub account if you haven't already, and select your `CMK-Assistant` repository. Click **Connect**.

4.  Render will automatically detect the `render.yaml` file in your repository. Give your service a unique name (e.g., `cmk-asistani-prod`) and click **Apply**.

Render will now start the first deployment. **It will fail**, and this is expected! This is because we haven't added our secret API keys yet.

---

### Step 2: Add Environment Variables (API Keys)

We need to securely provide our API keys to the Render service.

1.  In your new service's dashboard, go to the **Environment** tab.

2.  Under **Secret Files**, click **Add Secret File**.

3.  Create a secret file with the following details:
    *   **Filename:** `.env`
    *   **Contents:** Copy the contents of your local `.env` file and paste them here. Make sure you are using your **actual API keys**, not the placeholder values.

    ```
    # Example .env contents
    OPENROUTER_API_KEY="sk-or-v1-..."
    MODEL_NAME="google/gemini-pro"
    OPENAI_API_KEY="sk-..."
    VECTOR_STORE_PATH="./chroma_db"
    DATA_PATH="./data"
    ```

4.  Click **Save Changes**.

---

### Step 3: Trigger a New Deployment

Adding the environment variables will not automatically restart the failed deployment.

1.  Go to the **Events** tab for your service.
2.  Click the **Deploy** button and select **Trigger deploy**. This will start a new build with the correct environment variables.

3.  You can watch the deployment logs in real-time. You should see the `pip install`, `python scripts/ingest.py`, and server startup messages. A successful deployment will show a "Live" status.

---

### Step 4: Use Your Live API

Once the deployment is complete, Render will provide you with a public URL for your service (e.g., `https://your-service-name.onrender.com`).

This is the URL you will use in your mobile app's `.env` file for `EXPO_PUBLIC_API_URL`.

**Important Note on Free Tier:**
Render's free tier services "spin down" after 15 minutes of inactivity. This means the first request after a period of inactivity might take 30-60 seconds to respond while the server starts up. Subsequent requests will be fast. This is a standard trade-off for free hosting. For a production app with paying users, you would upgrade to a paid plan to prevent this.

Your backend is now live! 