# Deployment Guide

This guide covers various deployment options for the Hono Website Audit API.

## 🚀 Quick Deploy Options

### Vercel (Recommended for Serverless)

1. Install Vercel CLI: `npm i -g vercel`
2. Build the project: `npm run build`
3. Deploy: `vercel --prod`

**Note**: Vercel has limitations with Puppeteer. Consider using Railway or Render for full functionality.

### Railway (Recommended for Full Features)

1. Connect your GitHub repository to Railway
2. Railway will automatically detect the `railway.toml` configuration
3. Deploy with one click

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Render

1. Connect your GitHub repository to Render
2. Render will use the `render.yaml` configuration
3. Deploy automatically

### Heroku

1. Install Heroku CLI
2. Create a new Heroku app: `heroku create your-app-name`
3. Add buildpacks:
   ```bash
   heroku buildpacks:add heroku/nodejs
   heroku buildpacks:add jontewks/puppeteer
   ```
4. Deploy: `git push heroku main`

## 🐳 Docker Deployment

### Local Docker

```bash
# Build the image
docker build -t hono-audit-api .

# Run the container
docker run -p 3000:3000 hono-audit-api
```

### Docker Compose

```bash
docker-compose up -d
```

### Docker Hub

```bash
# Build and tag
docker build -t your-username/hono-audit-api .

# Push to Docker Hub
docker push your-username/hono-audit-api
```

## ☁️ Cloud Platform Specific Instructions

### AWS (using Docker)

1. Push to Amazon ECR
2. Deploy using ECS or Elastic Beanstalk
3. Configure load balancer and auto-scaling

### Google Cloud Platform

1. Build with Cloud Build: `gcloud builds submit`
2. Deploy to Cloud Run: `gcloud run deploy`

### Azure

1. Create Container Registry
2. Deploy to Azure Container Instances or App Service

## 🔧 Environment Variables

Set these environment variables in your deployment platform:

```bash
NODE_ENV=production
PORT=3000
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser  # or appropriate path
MAX_CONCURRENT_PAGES=2
SCREENSHOT_TTL_MS=1800000  # 30 minutes
```

## 🛠️ Platform-Specific Considerations

### Vercel Limitations
- Serverless functions have execution time limits
- Puppeteer may not work reliably
- Consider using for API-only deployments

### Railway Benefits
- Full Node.js environment
- Persistent storage
- Automatic HTTPS
- Easy scaling

### Render Benefits
- Free tier available
- Automatic deployments from Git
- Built-in monitoring

### Heroku Considerations
- Requires specific buildpacks for Puppeteer
- Dyno sleeping on free tier
- Good for development/testing

## 📊 Performance Optimization

### For Production Deployments:

1. **Enable compression**: Add gzip middleware
2. **Set up caching**: Cache audit results temporarily
3. **Configure rate limiting**: Prevent abuse
4. **Monitor resources**: Set up logging and monitoring
5. **Scale horizontally**: Use multiple instances for high traffic

### Memory Considerations:

- Puppeteer can be memory-intensive
- Consider increasing memory limits on cloud platforms
- Implement proper cleanup of browser instances

## 🔒 Security Considerations

1. **Environment Variables**: Never commit sensitive data
2. **Rate Limiting**: Implement to prevent abuse
3. **Input Validation**: Already implemented with Zod
4. **CORS**: Configure appropriately for your use case
5. **HTTPS**: Always use HTTPS in production

## 📈 Monitoring and Logging

### Health Checks
The API includes a `/health` endpoint for monitoring:
```bash
curl https://your-domain.com/health
```

### Logging
- All platforms support log aggregation
- Monitor error rates and response times
- Set up alerts for failures

## 🚨 Troubleshooting

### Common Issues:

1. **Puppeteer fails to launch**:
   - Ensure Chrome/Chromium is installed
   - Check executable path
   - Verify permissions

2. **Memory issues**:
   - Increase memory limits
   - Implement browser instance pooling
   - Add cleanup intervals

3. **Timeout errors**:
   - Increase timeout values
   - Optimize page loading
   - Implement retry logic

### Debug Mode:
Set `NODE_ENV=development` to enable detailed logging.

## 📞 Support

If you encounter deployment issues:
1. Check the logs for error messages
2. Verify environment variables are set correctly
3. Test locally with the same configuration
4. Open an issue on GitHub with deployment details
