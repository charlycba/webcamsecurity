# Webcam Security

A Dockerized web application that transforms your mobile phone into a security camera. This application provides real-time video streaming and monitoring capabilities using modern web technologies.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Docker Deployment](#docker-deployment)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

Webcam Security is a lightweight, browser-based security camera solution that leverages the MediaDevices getUserMedia API to access your device's camera. The application runs on a Linux VM (VirtualBox) and provides a simple interface for real-time video monitoring.

**Use Cases:**
- Home security monitoring
- Baby monitor
- Pet monitoring
- Remote workspace surveillance
- Temporary security solution

## ✨ Features

- 📱 **Mobile Device Support**: Turn any smartphone with a modern browser into a security camera
- 🎥 **Real-time Video Streaming**: Low-latency video feed using WebRTC
- 🐳 **Dockerized**: Easy deployment with Docker and Docker Compose
- 🔒 **Secure Access**: Browser-based access with secure protocols
- 💻 **Cross-platform**: Works on any device with a modern web browser
- 🚀 **Lightweight**: Minimal resource usage on the host machine

## 🏗️ Architecture

### Technology Stack

**Backend:**
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **WebSocket/Socket.io**: Real-time bidirectional communication (if applicable)

**Frontend:**
- **HTML5**: Structure and layout
- **CSS3**: Styling and responsive design
- **Vanilla JavaScript**: Client-side logic
- **MediaDevices getUserMedia API**: Camera access and video streaming

**Infrastructure:**
- **Docker**: Containerization
- **VirtualBox**: Linux VM hosting
- **Linux**: Operating system (Ubuntu/Debian recommended)

### Architecture Diagram

```
┌─────────────────────────────────────────────┐
│          Mobile Device (Camera)             │
│  ┌──────────────────────────────────────┐  │
│  │  Web Browser (Chrome/Firefox/Safari) │  │
│  │  - getUserMedia API                  │  │
│  │  - WebRTC Streaming                  │  │
│  └──────────────────────────────────────┘  │
└─────────────────┬───────────────────────────┘
                  │ HTTPS/WebSocket
                  ▼
┌─────────────────────────────────────────────┐
│        Linux VM (VirtualBox)                │
│  ┌──────────────────────────────────────┐  │
│  │         Docker Container             │  │
│  │  ┌────────────────────────────────┐ │  │
│  │  │    Node.js + Express Server    │ │  │
│  │  │  - Routes                      │ │  │
│  │  │  - Static file serving         │ │  │
│  │  │  - WebSocket handling          │ │  │
│  │  └────────────────────────────────┘ │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│      Monitoring Device (Viewer)             │
│         Web Browser                         │
└─────────────────────────────────────────────┘
```

### Request Flow

1. **Camera Device**: Accesses the web application through a browser
2. **getUserMedia**: Browser requests camera permissions
3. **Video Stream**: Camera feed is captured and transmitted via WebRTC
4. **Backend Processing**: Node.js/Express server handles routing and stream management
5. **Monitoring Client**: Viewers access the stream through the web interface

## 📦 Prerequisites

Before installing and running this application, ensure you have:

### Required Software

- **Node.js**: Version 14.x or higher
  ```bash
  node --version  # Should be v14.0.0 or higher
  ```

- **npm**: Version 6.x or higher (comes with Node.js)
  ```bash
  npm --version
  ```

- **Docker**: Version 20.x or higher
  ```bash
  docker --version
  ```

- **Docker Compose**: Version 1.27 or higher
  ```bash
  docker-compose --version
  ```

### System Requirements

- **Linux VM (VirtualBox)**:
  - Ubuntu 20.04 LTS or newer (recommended)
  - Debian 10 or newer
  - At least 2GB RAM
  - 10GB free disk space
  - Network access

- **Browser Compatibility** (Camera Device):
  - Chrome 53+
  - Firefox 36+
  - Safari 11+
  - Edge 79+

### Network Requirements

- Devices must be on the same network for local access
- For remote access, port forwarding or VPN may be required
- HTTPS required for getUserMedia API on non-localhost connections

## 🚀 Installation

### Option 1: Docker Installation (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/charlycba/webcamsecurity.git
   cd webcamsecurity
   ```

2. **Build and run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Verify the container is running:**
   ```bash
   docker ps
   ```

4. **Access the application:**
   - Open your browser and navigate to `http://localhost:3000`
   - Or use your VM's IP address: `http://<VM_IP>:3000`

### Option 2: Local Installation (Development)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/charlycba/webcamsecurity.git
   cd webcamsecurity
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

4. **Access the application:**
   - Open your browser and navigate to `http://localhost:3000`

## 📱 Usage

### Setting Up Your Camera Device

1. **Connect your mobile device to the same network** as the server (VM)

2. **Open a web browser** on your mobile device (Chrome, Firefox, or Safari)

3. **Navigate to the application URL:**
   - Local network: `http://<VM_IP>:3000`
   - Localhost (if on same machine): `http://localhost:3000`

4. **Grant camera permissions** when prompted by the browser

5. **Position your device** as desired for monitoring

6. **Keep the browser tab active** and the screen on (adjust device settings if needed)

### Monitoring the Stream

1. **On your monitoring device**, open a web browser

2. **Navigate to the viewer page:**
   - Usually: `http://<VM_IP>:3000` or `http://<VM_IP>:3000/viewer`

3. **View the live camera feed** from your mobile device

### Tips for Best Performance

- **Use a stable WiFi connection** for both devices
- **Keep the mobile device plugged in** to prevent battery drain
- **Adjust video quality settings** if experiencing lag
- **Use a phone stand or mount** for stable positioning
- **Ensure good lighting** in the monitored area

## 🐳 Docker Deployment

### Building the Docker Image

```bash
docker build -t webcamsecurity:latest .
```

### Running with Docker

```bash
docker run -d \
  --name webcamsecurity \
  -p 3000:3000 \
  webcamsecurity:latest
```

### Using Docker Compose

The application includes a `docker-compose.yml` file for easy deployment:

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

### Environment Configuration

Create an environment file (.env) in the project root with the following configuration options:

**Server Settings:**
- PORT: Application port number (default: 3000)
- NODE_ENV: Runtime environment (development/production)
- HOST: Bind address (0.0.0.0 for all interfaces)

**Optional Stream Settings:**
- MAX_BITRATE: Maximum video bitrate in kbps
- VIDEO_RESOLUTION: Target resolution preset

## ⚙️ Configuration

### Server Configuration

Edit `server.js` or use environment variables to configure:

- **Port**: Default is 3000, change via `PORT` environment variable
- **Host**: Default is 0.0.0.0 (all interfaces)
- **CORS**: Configure allowed origins for cross-origin requests

### Camera Settings

The frontend implementation allows adjusting camera parameters through the MediaDevices constraints object. Configure video dimensions (width and height with ideal values), frame rate targets, and audio capture settings based on performance requirements and bandwidth availability.

### VirtualBox Network Setup

**NAT with Port Forwarding:**
1. Open VirtualBox Manager
2. Select your VM → Settings → Network
3. Adapter 1: NAT
4. Advanced → Port Forwarding
5. Add rule: Host Port 3000 → Guest Port 3000

**Bridged Adapter (Recommended):**
1. Open VirtualBox Manager
2. Select your VM → Settings → Network
3. Adapter 1: Bridged Adapter
4. Select your host's network interface
5. VM will get its own IP on your network

## 🔧 Troubleshooting

### Camera Not Working

**Issue**: Browser doesn't access the camera
- **Solution 1**: Ensure HTTPS is used (required for getUserMedia on non-localhost)
- **Solution 2**: Check browser permissions: Settings → Privacy → Camera
- **Solution 3**: Try a different browser (Chrome recommended)
- **Solution 4**: Ensure no other app is using the camera

### Cannot Access the Application

**Issue**: Cannot reach `http://<VM_IP>:3000`
- **Solution 1**: Check if Docker container is running: `docker ps`
- **Solution 2**: Verify port mapping: `docker port webcamsecurity`
- **Solution 3**: Check firewall rules on the VM:
  ```bash
  sudo ufw allow 3000/tcp
  ```
- **Solution 4**: Verify VM network settings in VirtualBox

### Video Stream Lag

**Issue**: Video feed is laggy or stuttering
- **Solution 1**: Reduce video resolution in camera constraints
- **Solution 2**: Check network bandwidth and WiFi signal strength
- **Solution 3**: Close other bandwidth-intensive applications
- **Solution 4**: Reduce frame rate in camera settings

### Docker Issues

**Issue**: Docker container fails to start
- **Solution 1**: Check Docker logs:
  ```bash
  docker logs webcamsecurity
  ```
- **Solution 2**: Ensure port 3000 is not already in use:
  ```bash
  sudo lsof -i :3000
  ```
- **Solution 3**: Rebuild the Docker image:
  ```bash
  docker-compose down
  docker-compose up -d --build
  ```

### HTTPS Certificate Issues

**Issue**: getUserMedia requires HTTPS but showing certificate errors
- **Solution 1**: For local development, use `localhost` which allows HTTP
- **Solution 2**: Generate self-signed certificates for testing
- **Solution 3**: Use a reverse proxy like nginx with Let's Encrypt for production

## 🚀 Future Improvements

### Planned Features

1. **Motion Detection**
   - Implement computer vision algorithms to detect movement
   - Send alerts when motion is detected
   - Record video clips when motion occurs

2. **Multi-Camera Support**
   - Connect multiple camera devices simultaneously
   - Grid view for monitoring multiple feeds
   - Camera naming and management

3. **Recording and Playback**
   - Save video streams to disk
   - Playback interface for recorded footage
   - Configurable retention policies

4. **Authentication and Security**
   - User login system with JWT
   - Role-based access control (viewer vs. admin)
   - Encrypted video streams
   - Two-factor authentication

5. **Mobile App**
   - Native Android/iOS apps for better performance
   - Push notifications for alerts
   - Background operation support

6. **Enhanced Streaming**
   - Adaptive bitrate streaming
   - Support for multiple video codecs (H.264, VP8, VP9)
   - Lower latency with improved WebRTC implementation

7. **Cloud Integration**
   - Cloud storage for recordings (AWS S3, Google Cloud Storage)
   - Cloud-based streaming for remote access
   - Automatic backup of footage

8. **AI-Powered Features**
   - Facial recognition
   - Object detection (person, vehicle, animal)
   - Smart alerts based on detected objects
   - Activity zones configuration

9. **UI/UX Improvements**
   - Dark mode
   - Responsive design for tablets
   - Picture-in-picture mode
   - Full-screen viewing option

10. **System Health Monitoring**
    - Dashboard with system metrics
    - Camera connection status indicators
    - Bandwidth usage monitoring
    - Storage space alerts

### Technical Improvements

1. **Performance Optimization**
   - WebSocket connection pooling
   - Video stream caching
   - Resource usage optimization

2. **Testing**
   - Unit tests with Jest
   - Integration tests
   - End-to-end tests with Playwright
   - Performance testing

3. **Documentation**
   - API documentation with Swagger/OpenAPI
   - Architecture diagrams
   - Deployment guides for cloud platforms

4. **DevOps**
   - CI/CD pipeline setup
   - Automated Docker image builds
   - Kubernetes deployment manifests
   - Monitoring with Prometheus and Grafana

5. **Code Quality**
   - ESLint configuration
   - Prettier for code formatting
   - Husky for pre-commit hooks
   - SonarQube integration

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Write clear commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- **charlycba** - *Initial work* - [charlycba](https://github.com/charlycba)

## 🙏 Acknowledgments

- MediaDevices getUserMedia API documentation
- WebRTC community
- Docker and Node.js communities
- All contributors to this project

## 📞 Support

For support, please:
- Open an issue on GitHub
- Check the [Troubleshooting](#troubleshooting) section
- Review existing issues for similar problems

---

**Note**: This application is intended for personal and educational use. Ensure you comply with local privacy laws and regulations when using surveillance cameras.
