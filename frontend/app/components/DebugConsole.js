"use client";

import { useState, useEffect, useRef } from "react";

export default function DebugConsole({
  ws,
  apiStatus,
  images,
  loading,
  error,
  chunkError,
  offlineMode,
  logs = [],
  onClearLogs,
  onTestApi,
}) {
  const [activeTab, setActiveTab] = useState("Console");
  const [wsStatus, setWsStatus] = useState("Disconnected");
  const [wsMessages, setWsMessages] = useState([]);

  // Monitor WebSocket status
  useEffect(() => {
    if (!ws?.current) return;

    const updateWsStatus = () => {
      if (ws.current) {
        switch (ws.current.readyState) {
          case WebSocket.CONNECTING:
            setWsStatus("Connecting...");
            break;
          case WebSocket.OPEN:
            setWsStatus("Connected");
            break;
          case WebSocket.CLOSING:
            setWsStatus("Closing...");
            break;
          case WebSocket.CLOSED:
            setWsStatus("Disconnected");
            break;
          default:
            setWsStatus("Unknown");
        }
      }
    };

    // Set up WebSocket event listeners
    const originalOnMessage = ws.current.onmessage;
    ws.current.onmessage = (event) => {
      if (originalOnMessage) originalOnMessage(event);

      const timestamp = new Date().toLocaleTimeString();
      setWsMessages((prev) =>
        [
          {
            id: Date.now(),
            timestamp,
            data: event.data,
            type: typeof event.data,
          },
          ...prev,
        ].slice(0, 20)
      );
    };

    const originalOnOpen = ws.current.onopen;
    ws.current.onopen = (event) => {
      if (originalOnOpen) originalOnOpen(event);
      updateWsStatus();
    };

    const originalOnClose = ws.current.onclose;
    ws.current.onclose = (event) => {
      if (originalOnClose) originalOnClose(event);
      updateWsStatus();
    };

    const originalOnError = ws.current.onerror;
    ws.current.onerror = (event) => {
      if (originalOnError) originalOnError(event);
      updateWsStatus();
    };

    updateWsStatus();

    // Update status periodically
    const interval = setInterval(updateWsStatus, 1000);
    return () => clearInterval(interval);
  }, [ws]);

  const clearLogs = () => {
    if (onClearLogs) {
      onClearLogs();
    }
  };

  const clearWsMessages = () => {
    setWsMessages([]);
  };

  return (
    <div
      data-debug-console
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        width: "400px",
        maxHeight: "80vh",
        background: "rgba(0, 0, 0, 0.9)",
        color: "white",
        padding: "15px",
        borderRadius: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
        pointerEvents: "auto",
        zIndex: 1000,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          borderBottom: "1px solid #333",
          paddingBottom: "5px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "14px" }}>Debug Console</h3>
        <button
          onClick={() => {
            // This will be handled by the parent component
            window.dispatchEvent(new CustomEvent("closeDebugConsole"));
          }}
          style={{
            background: "red",
            color: "white",
            border: "none",
            borderRadius: "3px",
            padding: "2px 6px",
            cursor: "pointer",
            fontSize: "10px",
          }}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          marginBottom: "10px",
          borderBottom: "1px solid #333",
        }}
      >
        {["Status", "Console", "WebSocket"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "transparent",
              color: "white",
              border: "none",
              padding: "5px 10px",
              cursor: "pointer",
              fontSize: "11px",
              borderBottom:
                activeTab === tab
                  ? "2px solid #007acc"
                  : "2px solid transparent",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "Status" && (
          <div>
            <div>
              <strong>Mode:</strong> {offlineMode ? "Offline" : "Online"}
            </div>
            <div>
              <strong>API Status:</strong> {apiStatus?.status || "Unknown"}
            </div>
            <div>
              <strong>Images Loaded:</strong> {images?.length || 0}
            </div>
            <div>
              <strong>Loading:</strong> {loading ? "Yes" : "No"}
            </div>
            {error && (
              <div style={{ color: "red" }}>
                <strong>Error:</strong> {error}
              </div>
            )}
            {chunkError && (
              <div style={{ color: "orange" }}>
                <strong>Chunk Error:</strong> {chunkError}
              </div>
            )}
            <div>
              <strong>WebSocket:</strong> {wsStatus}
            </div>
            <div>
              <strong>Timestamp:</strong> {new Date().toLocaleString()}
            </div>

            {/* Test API Button */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            >
              <div style={{ marginBottom: "10px", fontWeight: "bold" }}>
                API Testing
              </div>
              <button
                onClick={onTestApi}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#007acc",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                🧪 Test API Connection
              </button>
              <div
                style={{ fontSize: "11px", color: "#666", marginTop: "5px" }}
              >
                This will test the API connection and show results in console
              </div>
            </div>
          </div>
        )}

        {activeTab === "Console" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "5px",
              }}
            >
              <span>Console Logs ({logs.length})</span>
              <button
                onClick={clearLogs}
                style={{
                  background: "#333",
                  color: "white",
                  border: "none",
                  borderRadius: "3px",
                  padding: "2px 6px",
                  cursor: "pointer",
                  fontSize: "10px",
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ maxHeight: "300px", overflow: "auto" }}>
              {logs.length === 0 ? (
                <div style={{ color: "#666" }}>No logs yet...</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      marginBottom: "3px",
                      padding: "2px",
                      borderRadius: "2px",
                      backgroundColor:
                        log.level === "error"
                          ? "rgba(255,0,0,0.2)"
                          : log.level === "warn"
                          ? "rgba(255,165,0,0.2)"
                          : "transparent",
                    }}
                  >
                    <span style={{ color: "#888" }}>[{log.timestamp}]</span>
                    <span
                      style={{
                        color:
                          log.level === "error"
                            ? "#ff6b6b"
                            : log.level === "warn"
                            ? "#ffa726"
                            : log.level === "info"
                            ? "#42a5f5"
                            : "#fff",
                        marginLeft: "5px",
                      }}
                    >
                      [{log.level.toUpperCase()}]
                    </span>
                    <span style={{ marginLeft: "5px" }}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "WebSocket" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "5px",
              }}
            >
              <span>WebSocket Messages ({wsMessages.length})</span>
              <button
                onClick={clearWsMessages}
                style={{
                  background: "#333",
                  color: "white",
                  border: "none",
                  borderRadius: "3px",
                  padding: "2px 6px",
                  cursor: "pointer",
                  fontSize: "10px",
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <strong>Status:</strong> {wsStatus}
            </div>
            <div style={{ maxHeight: "250px", overflow: "auto" }}>
              {wsMessages.length === 0 ? (
                <div style={{ color: "#666" }}>No messages yet...</div>
              ) : (
                wsMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: "3px",
                      padding: "2px",
                      backgroundColor: "rgba(0, 122, 204, 0.1)",
                      borderRadius: "2px",
                    }}
                  >
                    <div style={{ color: "#888", fontSize: "10px" }}>
                      [{msg.timestamp}]
                    </div>
                    <div style={{ wordBreak: "break-all" }}>
                      {msg.type === "string"
                        ? msg.data
                        : JSON.stringify(msg.data)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "10px",
          paddingTop: "5px",
          borderTop: "1px solid #333",
          fontSize: "10px",
          color: "#888",
        }}
      >
        Press Ctrl+Shift+D to toggle • VR Debug Console
      </div>
    </div>
  );
}
