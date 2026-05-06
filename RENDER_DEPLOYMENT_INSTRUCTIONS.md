# Render Deployment Instructions

Render can deploy the NexusEdu backend using either a Docker container or the native Python environment. Since we need system-level tools for `Pillow`, Docker is the recommended approach.

## Recommended: Docker Environment

We have provided a `Dockerfile` inside the `backend` folder that works perfectly around Render's free tier limitations and includes necessary system headers (libjpeg-dev, zlib1g-dev) for image processing with `Pillow`.

**To deploy using Docker on Render.com:**
1. Connect your repository to Render to create a new "Web Service".
2. Under "Environment", select **Docker**.
3. In the Render Dashboard, set the **Dockerfile path** to: `./backend/Dockerfile`
4. Set the **Root Directory** to: `backend` (or set Dockerfile path to `Dockerfile` and Build Context to `.` if you launch from backend dir). It's recommended to just set the **Root Directory** setting to `backend`.
5. Set `PORT=8080` in the Render **Environment Variables** section.

## Alternative: Native Python Environment

If you prefer to deploy as a native Python web service rather than Docker:
1. Under "Environment", select **Python**.
2. Set the **Build Command** to: `cd backend && pip install -r requirements.txt`
3. Set the **Start Command** to: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Make sure to define the `PYTHON_VERSION` environment variable in the dashboard to `3.11.11`.
5. Since Render uses the file `.python-version` and `runtime.txt`, we have included `python-3.11.11` in `/backend/runtime.txt` and `.python-version`. Note: If Render still defaults to 3.14.3 due to the working directory structure, specifying the `PYTHON_VERSION` environment variable directly in the Render dashboard will force it to use `3.11.11`.
