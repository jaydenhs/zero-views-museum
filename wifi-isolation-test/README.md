# Wi-Fi Client Isolation Test

This tool helps you test whether a Wi-Fi network has client isolation enabled and whether WebSocket connections are allowed between clients.

## What is Client Isolation?

Client isolation (also called AP isolation or station isolation) is a security feature that prevents devices connected to the same Wi-Fi network from communicating directly with each other. When enabled:

- Devices can only communicate with the router/gateway
- Direct device-to-device communication is blocked
- WebSocket connections between clients may be restricted

## How This Test Works

The test creates a WebSocket server that multiple clients can connect to, then tests various communication patterns:

1. **Ping Test**: Tests basic WebSocket connectivity and latency
2. **Broadcast Test**: Tests if the server can broadcast messages to all connected clients
3. **Direct Message Test**: Tests if clients can send messages to each other through the server
4. **Client Discovery**: Tests if clients can see other connected clients

## Setup Instructions

### 1. Install Dependencies

```bash
cd wifi-isolation-test
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start on port 3000 and display the local IP address.

### 3. Access the Test Interface

Open your browser and go to:

- `http://localhost:3000` (if testing from the same machine)
- `http://[YOUR_IP]:3000` (if testing from other devices on the network)

## Testing Procedure

### Single Device Test

1. Open the test page in your browser
2. Click "Connect" to connect to the WebSocket server
3. Run individual tests or click "Run All Tests"
4. Check the results to see what communication is possible

### Multi-Device Test (Recommended)

1. Start the server on one device
2. Open the test page on multiple devices connected to the same Wi-Fi network
3. Connect all devices to the server
4. Run tests to see if devices can communicate with each other

## Interpreting Results

### If Client Isolation is DISABLED:

- ✅ All tests should pass
- ✅ Devices can see each other in the clients list
- ✅ Broadcast messages reach all connected devices
- ✅ Direct messages between clients work
- ✅ Low latency ping responses

### If Client Isolation is ENABLED:

- ❌ Devices may not be able to connect to the server from other devices
- ❌ Only the device running the server can connect
- ❌ Other devices will get connection errors
- ❌ No client-to-client communication possible

### If WebSockets are BLOCKED:

- ❌ Connection will fail entirely
- ❌ Browser will show WebSocket connection errors
- ❌ No communication possible

## Test Scenarios

### Scenario 1: Home Wi-Fi Network

Most home routers have client isolation disabled by default, so all tests should pass.

### Scenario 2: Public Wi-Fi (Coffee Shop, Hotel, etc.)

Many public networks have client isolation enabled for security, so direct communication may be blocked.

### Scenario 3: Corporate/Enterprise Network

Enterprise networks often have strict security policies that may block WebSocket connections or enable client isolation.

### Scenario 4: Mobile Hotspot

Mobile hotspots may have varying policies depending on the carrier and device.

## Troubleshooting

### Connection Refused

- Check if the server is running
- Verify the IP address and port
- Check firewall settings
- Ensure devices are on the same network

### WebSocket Connection Failed

- Try using `wss://` instead of `ws://` for HTTPS
- Check if the network blocks WebSocket connections
- Verify the server URL is correct

### No Other Clients Visible

- This may indicate client isolation is enabled
- Try connecting from different devices
- Check if the network allows peer-to-peer communication

## Files

- `websocket-server.js` - Main server that handles WebSocket connections
- `test.html` - Web interface for running tests
- `test.js` - Client-side JavaScript for test functionality
- `package.json` - Node.js dependencies and scripts

## Security Note

This tool is designed for testing purposes only. Do not use it on networks you don't own or have permission to test. Some networks may have policies against running servers or testing connectivity.

## License

MIT License - Feel free to modify and use for your testing needs.
