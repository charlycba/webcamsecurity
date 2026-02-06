# Architecture Documentation

## System Overview

Webcam Security is a client-server application that enables real-time video streaming from a mobile device's camera to monitoring clients through a web browser interface.

## Technology Stack

### Backend Stack
- **Runtime**: Node.js (v14+)
- **Framework**: Express.js
- **Communication**: WebSocket/Socket.io (for real-time bidirectional communication)
- **Container**: Docker

### Frontend Stack
- **HTML5**: Semantic markup and structure
- **CSS3**: Styling with responsive design principles
- **JavaScript (ES6+)**: Client-side logic
- **WebRTC**: Real-time communication protocol
- **MediaDevices API**: Camera and media access

### Infrastructure
- **Host OS**: Linux (Ubuntu/Debian)
- **Virtualization**: VirtualBox
- **Containerization**: Docker + Docker Compose

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐              ┌──────────────────┐    │
│  │  Camera Client   │              │  Viewer Client   │    │
│  │  (Mobile Device) │              │  (Any Device)    │    │
│  └────────┬─────────┘              └────────┬─────────┘    │
│           │                                  │               │
│           │ getUserMedia                     │               │
│           │ WebRTC Stream                    │ Display Stream│
│           │                                  │               │
└───────────┼──────────────────────────────────┼───────────────┘
            │                                  │
            │         HTTPS/WebSocket          │
            │                                  │
┌───────────┼──────────────────────────────────┼───────────────┐
│           │     Application Layer            │               │
├───────────┼──────────────────────────────────┼───────────────┤
│           │                                  │               │
│           ▼                                  ▼               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Express.js Server                       │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │  Routing   │  │   WebSocket  │  │   Static    │ │  │
│  │  │  Engine    │  │   Handler    │  │   Files     │ │  │
│  │  └────────────┘  └──────────────┘  └─────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
            │
            │ Containerized in Docker
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Docker Container                         │  │
│  │  - Isolated runtime environment                      │  │
│  │  - Port mapping (3000:3000)                          │  │
│  │  - Volume mounts (if needed)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Linux VM (VirtualBox)                       │  │
│  │  - Ubuntu/Debian OS                                  │  │
│  │  - Docker Runtime                                    │  │
│  │  - Network Bridge                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Descriptions

### 1. Camera Client (Mobile Device)

**Purpose**: Captures and streams video from the device's camera

**Key Technologies**:
- MediaDevices.getUserMedia() API
- WebRTC for peer-to-peer streaming
- HTML5 Canvas (optional, for preprocessing)

**Workflow**:
1. User navigates to the application URL
2. Browser requests camera permissions via getUserMedia()
3. User grants permissions
4. Video stream is captured from the camera
5. Stream is encoded and transmitted via WebRTC
6. Connection maintained via WebSocket for signaling

**Implementation Approach**:
- Request camera access with specified resolution and frame rate constraints
- Handle user permission grant/deny scenarios
- Attach media stream to video element for local preview
- Establish WebRTC connection to forward stream to backend
- Implement error handling for various failure scenarios (permission denied, hardware unavailable, etc.)

### 2. Viewer Client

**Purpose**: Displays the video stream from camera devices

**Key Technologies**:
- HTML5 Video element
- WebRTC for receiving stream
- WebSocket for communication

**Workflow**:
1. User navigates to the viewer page
2. Client establishes WebSocket connection
3. Receives WebRTC stream from the server
4. Displays video in HTML5 video element
5. Maintains connection for real-time updates

### 3. Express.js Server

**Purpose**: Coordinates communication between camera and viewer clients

**Key Responsibilities**:
- Serve static HTML/CSS/JS files
- Handle WebSocket connections
- Manage WebRTC signaling
- Route HTTP requests
- (Optional) Store video streams or metadata

### Expected Routes Structure

The application should provide:
- Root endpoint serving the camera client interface
- Viewer endpoint for monitoring display
- Static asset serving for CSS, JavaScript, and images
- WebSocket endpoint for real-time video streaming

### Server Responsibilities

The backend server handles:
- Serving HTML pages and static resources
- Managing WebSocket connections for real-time communication
- Coordinating WebRTC signaling between cameras and viewers
- Processing and routing HTTP requests
- Optional: Persistent storage for video streams or session metadata

### 4. Docker Container

**Purpose**: Package and isolate the application environment

### Docker Configuration Pattern

The Dockerfile should:
- Use a Node.js base image (Alpine variant for smaller size)
- Set appropriate working directory
- Copy dependency manifests and install production dependencies
- Copy application source code
- Expose the application port (3000)
- Define the startup command to launch the server

### Docker Compose Structure

The compose file should define:
- Service name and build configuration
- Port mapping from host to container
- Environment variables for runtime configuration
- Restart policy for automatic recovery
- Optional: Volume mounts for persistent data

## Data Flow

### Camera Stream Flow

```
┌──────────────┐
│ Camera Start │
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│ getUserMedia() Request   │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ User Grants Permission   │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ MediaStream Captured     │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ WebRTC Peer Connection   │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Send via WebSocket       │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Server Receives Stream   │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Broadcast to Viewers     │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Viewer Receives Stream   │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Display in Video Element │
└──────────────────────────┘
```

### WebSocket Communication Flow

```
Camera Client                Server                  Viewer Client
     │                         │                           │
     │──── connect ───────────>│                           │
     │<─── ack ────────────────│                           │
     │                         │<──── connect ─────────────│
     │                         │───── ack ────────────────>│
     │                         │                           │
     │──── stream-offer ──────>│                           │
     │                         │───── stream-offer ───────>│
     │                         │<──── stream-answer ───────│
     │<─── stream-answer ──────│                           │
     │                         │                           │
     │──── video-data ────────>│                           │
     │                         │───── video-data ─────────>│
     │──── video-data ────────>│                           │
     │                         │───── video-data ─────────>│
     │         (continuous stream transmission)            │
     │                         │                           │
```

## Network Architecture

### VirtualBox Network Configuration

**Option 1: NAT with Port Forwarding**
```
Host Machine (Windows/Mac/Linux)
    │
    │ Port Forward: 3000 → 3000
    │
    ├─ VirtualBox NAT Network
    │    │
    │    └─ Linux VM (Guest)
    │         │
    │         └─ Docker Container (Port 3000)
```

**Option 2: Bridged Adapter (Recommended)**
```
Local Network (192.168.1.0/24)
    │
    ├─ Host Machine (192.168.1.10)
    ├─ Mobile Device (192.168.1.50)
    ├─ Viewer Device (192.168.1.60)
    │
    └─ Linux VM (192.168.1.100)
         │
         └─ Docker Container (Port 3000)
              Accessible at: http://192.168.1.100:3000
```

### Network Security Considerations

1. **Firewall Rules**: Open port 3000 on the VM
2. **HTTPS**: Use SSL/TLS for production (required for getUserMedia)
3. **CORS**: Configure appropriate CORS headers
4. **Authentication**: Implement authentication for production use

## Security Architecture

### Current Security Measures

1. **Browser Security**: getUserMedia requires user permission
2. **Docker Isolation**: Application runs in isolated container
3. **Network Isolation**: VM provides additional layer of isolation

### Recommended Security Enhancements

1. **Authentication Layer**
   - JWT-based authentication
   - Session management
   - Password hashing with bcrypt

2. **HTTPS/TLS**
   - SSL certificates for encrypted communication
   - Let's Encrypt for automatic certificate management
   - Redirect HTTP to HTTPS

3. **Access Control**
   - Role-based permissions (admin, viewer, camera)
   - IP whitelisting for trusted devices
   - Rate limiting to prevent abuse

4. **Stream Encryption**
   - SRTP (Secure Real-time Transport Protocol)
   - End-to-end encryption for video streams

## Scalability Considerations

### Current Limitations

- Single-server architecture
- Limited concurrent connections
- No load balancing
- No horizontal scaling

### Scaling Strategies

1. **Vertical Scaling**
   - Increase VM resources (CPU, RAM)
   - Optimize Node.js performance
   - Use clustering for multi-core utilization

2. **Horizontal Scaling**
   - Multiple server instances
   - Load balancer (nginx, HAProxy)
   - Shared session storage (Redis)

3. **Microservices Architecture**
   - Separate streaming service
   - Separate authentication service
   - Message queue for async operations

4. **Cloud Deployment**
   - Kubernetes for orchestration
   - Auto-scaling based on load
   - CDN for static asset delivery

## Performance Optimization

### Current Performance Characteristics

- **Latency**: ~100-500ms (depends on network)
- **Bandwidth**: ~1-3 Mbps per stream
- **Concurrent Users**: Limited by server resources

### Optimization Strategies

1. **Video Compression**
   - Use efficient codecs (H.264, VP9)
   - Adaptive bitrate streaming
   - Dynamic resolution adjustment

2. **WebSocket Optimization**
   - Connection pooling
   - Message batching
   - Binary data transmission

3. **Caching**
   - Static asset caching
   - CDN for global distribution
   - Browser caching headers

4. **Code Optimization**
   - Minify JavaScript and CSS
   - Lazy loading for resources
   - Tree shaking for unused code

## Monitoring and Observability

### Recommended Monitoring Tools

1. **Application Monitoring**
   - PM2 for process management
   - New Relic or Datadog for APM
   - Custom health check endpoints

2. **Infrastructure Monitoring**
   - Prometheus for metrics collection
   - Grafana for visualization
   - Docker stats for container monitoring

3. **Logging**
   - Winston or Bunyan for structured logging
   - Elasticsearch for log aggregation
   - Kibana for log visualization

### Key Metrics to Monitor

- Active connections count
- Stream bitrate and quality
- Server CPU and memory usage
- Network bandwidth usage
- Error rates and types
- Response times

## Development Workflow

### Development Commands

The project supports standard npm scripts:
- Dependency installation via npm install
- Development mode with auto-reload functionality
- Test execution for validation
- Production build process

### Docker Development Workflow

Docker-based development includes:
- Image building with development tag
- Container execution with port mapping
- Hot-reload development mode using development compose configuration

### Testing Strategy

1. **Unit Tests**: Test individual functions and modules
2. **Integration Tests**: Test API endpoints and WebSocket connections
3. **E2E Tests**: Test complete user workflows with Playwright
4. **Performance Tests**: Load testing with Artillery or k6
5. **Security Tests**: Vulnerability scanning with npm audit

## Deployment

### Production Deployment Checklist

- [ ] Environment variables configured
- [ ] HTTPS/SSL certificates installed
- [ ] Firewall rules configured
- [ ] Database backups enabled (if applicable)
- [ ] Monitoring and alerting set up
- [ ] Log aggregation configured
- [ ] Auto-scaling rules defined
- [ ] Disaster recovery plan documented
- [ ] Security audit completed
- [ ] Performance testing completed

### CI/CD Pipeline Stages

Continuous integration and deployment process:
1. Code push triggers pipeline
2. Linting and code quality checks
3. Automated test suite execution
4. Docker image building
5. Security vulnerability scanning
6. Push to container registry
7. Deploy to production server
8. Pull updated image
9. Container restart
10. Health check validation

## Troubleshooting Guide

### Common Issues and Solutions

1. **Camera not accessible**
   - Check browser permissions
   - Verify HTTPS is used (except localhost)
   - Test with different browsers

2. **Connection issues**
   - Verify network connectivity
   - Check firewall settings
   - Ensure correct port forwarding

3. **Performance problems**
   - Reduce video resolution
   - Check network bandwidth
   - Monitor server resources

4. **Docker issues**
   - Check container logs
   - Verify port mappings
   - Ensure sufficient resources

## API Reference (Expected Endpoints)

### Expected API Endpoints

**HTTP Interface:**
- Root path serves camera client page
- Viewer path serves monitoring interface
- Health check endpoint for system status monitoring
- Status API for retrieving server information

**WebSocket Communication:**

Camera to Server events:
- Initial connection establishment
- Video stream data transmission
- Disconnection notifications

Server to Viewer events:
- Forwarding video stream data
- Camera online/offline status updates
- Connection state changes

## Glossary

- **getUserMedia**: Browser API for accessing media devices
- **WebRTC**: Web Real-Time Communication protocol
- **WebSocket**: Protocol for bidirectional communication
- **NAT**: Network Address Translation
- **HTTPS**: HTTP Secure protocol
- **SRTP**: Secure Real-time Transport Protocol
- **JWT**: JSON Web Token for authentication
- **CORS**: Cross-Origin Resource Sharing

## References

- [MDN getUserMedia Documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [WebRTC Specification](https://www.w3.org/TR/webrtc/)
- [Express.js Documentation](https://expressjs.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Socket.io Documentation](https://socket.io/docs/)

---

*This architecture document is a living document and should be updated as the system evolves.*
