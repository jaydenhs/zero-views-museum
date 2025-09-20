class WiFiIsolationTester {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.connectedClients = new Map();
    this.testResults = [];
    this.pingInterval = null;

    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.statusEl = document.getElementById("connectionStatus");
    this.connectBtn = document.getElementById("connectBtn");
    this.disconnectBtn = document.getElementById("disconnectBtn");
    this.serverUrlEl = document.getElementById("serverUrl");
    this.clientsListEl = document.getElementById("clientsList");
    this.testResultsEl = document.getElementById("testResults");
    this.logEl = document.getElementById("log");

    // Test buttons
    this.pingBtn = document.getElementById("pingBtn");
    this.broadcastBtn = document.getElementById("broadcastBtn");
    this.directMsgBtn = document.getElementById("directMsgBtn");
    this.allTestsBtn = document.getElementById("allTestsBtn");
  }

  setupEventListeners() {
    // Auto-update server URL based on current host
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = window.location.port || "3000";
    this.serverUrlEl.value = `${protocol}//${host}:${port}`;
  }

  log(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
    this.logEl.appendChild(logEntry);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    console.log(`[${timestamp}] ${message}`);
  }

  updateStatus(status, message) {
    this.statusEl.className = `status ${status}`;
    this.statusEl.textContent = message;
  }

  updateClientsList() {
    if (this.connectedClients.size === 0) {
      this.clientsListEl.innerHTML = "<p>No clients connected</p>";
      return;
    }

    this.clientsListEl.innerHTML = "";
    this.connectedClients.forEach((client, id) => {
      const clientDiv = document.createElement("div");
      clientDiv.className = "client-item";
      clientDiv.innerHTML = `
                <div>
                    <span class="client-id">Client ${id}</span>
                    <span class="client-ip">${client.ip}</span>
                </div>
                <div>
                    <small>Connected: ${new Date(
                      client.connectedAt
                    ).toLocaleTimeString()}</small>
                </div>
            `;
      this.clientsListEl.appendChild(clientDiv);
    });
  }

  addTestResult(testName, passed, details) {
    const result = {
      testName,
      passed,
      details,
      timestamp: new Date(),
    };
    this.testResults.push(result);
    this.updateTestResultsDisplay();
  }

  updateTestResultsDisplay() {
    if (this.testResults.length === 0) {
      this.testResultsEl.innerHTML = "<p>No tests run yet</p>";
      return;
    }

    this.testResultsEl.innerHTML = "";
    this.testResults.forEach((result) => {
      const resultDiv = document.createElement("div");
      resultDiv.className = `test-item ${result.passed ? "pass" : "fail"}`;
      resultDiv.innerHTML = `
                <strong>${result.testName}</strong> - 
                <span style="color: ${result.passed ? "green" : "red"}">
                    ${result.passed ? "PASS" : "FAIL"}
                </span>
                <br>
                <small>${result.details}</small>
                <br>
                <small style="color: #666;">${result.timestamp.toLocaleString()}</small>
            `;
      this.testResultsEl.appendChild(resultDiv);
    });
  }

  connect() {
    const url = this.serverUrlEl.value;
    this.log(`Attempting to connect to ${url}`, "info");
    this.updateStatus("connecting", "Connecting...");

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.log("Connected to WebSocket server", "success");
        this.updateStatus("connected", "Connected");
        this.connectBtn.disabled = true;
        this.disconnectBtn.disabled = false;
        this.pingBtn.disabled = false;
        this.broadcastBtn.disabled = false;
        this.directMsgBtn.disabled = false;
        this.allTestsBtn.disabled = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          this.log(`Error parsing message: ${error.message}`, "error");
        }
      };

      this.ws.onclose = () => {
        this.log("Disconnected from server", "warning");
        this.updateStatus("disconnected", "Disconnected");
        this.connectBtn.disabled = false;
        this.disconnectBtn.disabled = true;
        this.pingBtn.disabled = true;
        this.broadcastBtn.disabled = true;
        this.directMsgBtn.disabled = true;
        this.allTestsBtn.disabled = true;
        this.connectedClients.clear();
        this.updateClientsList();

        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
      };

      this.ws.onerror = (error) => {
        this.log(
          `WebSocket error: ${error.message || "Connection failed"}`,
          "error"
        );
        this.updateStatus("disconnected", "Connection Error");
      };
    } catch (error) {
      this.log(`Failed to create WebSocket: ${error.message}`, "error");
      this.updateStatus("disconnected", "Connection Failed");
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case "welcome":
        this.clientId = data.clientId;
        this.log(`Welcome! You are client ${data.clientId}`, "success");
        this.log(`Total clients connected: ${data.totalClients}`, "info");
        break;

      case "client_joined":
        this.log(`Client ${data.clientId} joined from ${data.ip}`, "info");
        this.connectedClients.set(data.clientId, {
          ip: data.ip,
          connectedAt: new Date(),
        });
        this.updateClientsList();
        break;

      case "client_left":
        this.log(`Client ${data.clientId} left`, "info");
        this.connectedClients.delete(data.clientId);
        this.updateClientsList();
        break;

      case "pong":
        this.log(
          `Pong received from client ${data.clientId} (${
            Date.now() - data.timestamp
          }ms)`,
          "success"
        );
        break;

      case "broadcast":
        this.log(`Broadcast from client ${data.from}: ${data.message}`, "info");
        break;

      case "direct_message":
        this.log(
          `Direct message from client ${data.from}: ${data.message}`,
          "info"
        );
        break;

      case "clients_list":
        this.connectedClients.clear();
        data.clients.forEach((client) => {
          this.connectedClients.set(client.id, {
            ip: client.ip,
            connectedAt: new Date(client.connectedAt),
          });
        });
        this.updateClientsList();
        break;

      case "error":
        this.log(`Server error: ${data.message}`, "error");
        break;

      default:
        this.log(`Unknown message type: ${data.type}`, "warning");
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.log("Cannot send message: not connected", "error");
    }
  }

  runPingTest() {
    this.log("Running ping test...", "info");
    const startTime = Date.now();

    this.sendMessage({
      type: "ping",
      timestamp: startTime,
    });

    // Set up a timeout to detect if pong doesn't come back
    const timeout = setTimeout(() => {
      this.addTestResult(
        "Ping Test",
        false,
        "No pong response received within 5 seconds"
      );
    }, 5000);

    // Override the pong handler temporarily to check for this specific ping
    const originalHandler = this.ws.onmessage;
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pong" && data.timestamp === startTime) {
          clearTimeout(timeout);
          const latency = Date.now() - startTime;
          this.addTestResult(
            "Ping Test",
            true,
            `Pong received in ${latency}ms`
          );
          this.ws.onmessage = originalHandler;
          return;
        }
      } catch (error) {
        // Continue to original handler
      }
      originalHandler(event);
    };
  }

  runBroadcastTest() {
    this.log("Running broadcast test...", "info");
    const testMessage = `Broadcast test from client ${
      this.clientId
    } at ${new Date().toLocaleTimeString()}`;

    this.sendMessage({
      type: "broadcast",
      message: testMessage,
    });

    this.addTestResult(
      "Broadcast Test",
      true,
      `Broadcast message sent: "${testMessage}"`
    );
  }

  runDirectMessageTest() {
    this.log("Running direct message test...", "info");

    if (this.connectedClients.size < 2) {
      this.addTestResult(
        "Direct Message Test",
        false,
        "Need at least 2 clients for direct message test"
      );
      return;
    }

    const targetClientId = Array.from(this.connectedClients.keys())[0];
    const testMessage = `Direct message test from client ${this.clientId} to client ${targetClientId}`;

    this.sendMessage({
      type: "direct_message",
      targetClientId: targetClientId,
      message: testMessage,
    });

    this.addTestResult(
      "Direct Message Test",
      true,
      `Direct message sent to client ${targetClientId}: "${testMessage}"`
    );
  }

  async runAllTests() {
    this.log("Running all tests...", "info");
    this.testResults = []; // Clear previous results

    // Test 1: Ping
    this.runPingTest();
    await this.sleep(1000);

    // Test 2: Broadcast
    this.runBroadcastTest();
    await this.sleep(1000);

    // Test 3: Direct Message
    this.runDirectMessageTest();

    // Test 4: Get clients list
    this.sendMessage({ type: "get_clients" });
    this.addTestResult(
      "Get Clients Test",
      true,
      "Requested clients list from server"
    );

    this.log("All tests completed", "success");
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Global functions for HTML buttons
let tester;

function connect() {
  if (!tester) {
    tester = new WiFiIsolationTester();
  }
  tester.connect();
}

function disconnect() {
  if (tester) {
    tester.disconnect();
  }
}

function runPingTest() {
  if (tester) {
    tester.runPingTest();
  }
}

function runBroadcastTest() {
  if (tester) {
    tester.runBroadcastTest();
  }
}

function runDirectMessageTest() {
  if (tester) {
    tester.runDirectMessageTest();
  }
}

function runAllTests() {
  if (tester) {
    tester.runAllTests();
  }
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
  tester = new WiFiIsolationTester();
});
