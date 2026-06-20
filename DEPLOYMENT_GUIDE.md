# 🚀 Zero-Cost Deployment Guide

To host this project completely for free and win the hackathon, we will use a split architecture:
- **Frontend**: Hosted on Vercel (Free Tier, blazing fast global CDN)
- **Backend + Socket.IO**: Hosted on Render.com (Free Tier web service)

This architecture is robust, costs $0, and automatically redeploys when you push to GitHub!

---

## 1. Backend Deployment (Render.com)

Render allows you to host Node.js web services for free. We've already configured `render.yaml` for this!

1. Go to [Render.com](https://render.com) and sign up with your GitHub account.
2. Go to the **Dashboard** and click **New +** → **Blueprint**.
3. Connect your GitHub repository (`wooble-hackathon`).
4. Render will automatically detect the `render.yaml` file in the repository.
5. Click **Apply**.
6. Render will start building your backend. Wait for it to finish and become "Live".
7. Once live, copy your backend URL (it will look something like `https://queue-cure-backend.onrender.com`).

*Note: Free tier Render services spin down after 15 minutes of inactivity and take ~50 seconds to wake up on the first request. For a hackathon demo, just make sure to visit the backend URL 1 minute before your presentation to "wake it up"!*

---

## 2. Frontend Deployment (Vercel)

Vercel is the creator of Next.js and provides the best free hosting for Vite/React frontends.

1. Go to [Vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** → **Project**.
3. Import your `wooble-hackathon` repository.
4. In the configuration screen:
   - **Framework Preset**: Vercel should automatically detect "Vite".
   - **Root Directory**: Click "Edit" and select the `frontend` folder.
   - **Environment Variables**: Add a new variable:
     - **Name**: `VITE_SOCKET_URL`
     - **Value**: `[Paste the Render backend URL you got in Step 1]` (e.g., `https://queue-cure-backend.onrender.com`)
5. Click **Deploy**.
6. Wait 1 minute for Vercel to build and deploy.

### 🌟 Updating Your App

Since both Vercel and Render are connected to your GitHub, any time you run `git push`, **both the frontend and backend will automatically rebuild and redeploy!**

If you need to make changes during the hackathon:
```bash
git add .
git commit -m "My updates"
git push
```
Within 2 minutes, your live URLs will reflect the changes.

---

### Security Note

The backend `server.js` has been configured with relaxed CORS (`callback(null, true);`) to accept requests from any origin. This ensures that whatever URL Vercel assigns you, your frontend will successfully connect to the backend without CORS errors!
