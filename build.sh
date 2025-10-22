#!/bin/bash
# Build script for NubiqAI - Linux/Mac

echo "========================================"
echo "  Building NubiqAI for Production"
echo "========================================"
echo ""

# Frontend Build
echo "[1/2] Building Frontend..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Frontend dependencies installation failed!"
    exit 1
fi

npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Frontend build failed!"
    exit 1
fi
echo "✓ Frontend built successfully!"
echo ""

# Backend Setup
echo "[2/2] Setting up Backend..."
cd Server
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Backend dependencies installation failed!"
    exit 1
fi
echo "✓ Backend setup complete!"
cd ..
echo ""

echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Frontend files: dist/"
echo "Backend files: Server/"
echo ""
echo "Next steps:"
echo "1. Copy 'dist' folder to your web server"
echo "2. Copy 'Server' folder to your application server"
echo "3. Configure environment variables (.env)"
echo "4. Start backend with PM2 or Node"
echo ""
echo "See DEPLOYMENT_GUIDE.md for details!"
