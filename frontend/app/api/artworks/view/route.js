import { NextResponse } from "next/server";
import https from "https";

const FLASK_SERVER_URL = "https://zvm.jaydenh.com:5001";

// Create HTTPS agent that ignores SSL certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  checkServerIdentity: () => null,
});

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("Proxying mark as viewed request to Flask server:", body);

    const response = await fetch(`${FLASK_SERVER_URL}/api/artworks/view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // Use custom HTTPS agent to ignore SSL certificate errors
      agent: httpsAgent,
    });

    if (!response.ok) {
      console.error(`Flask server responded with status: ${response.status}`);
      return NextResponse.json(
        { error: `Flask server error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Mark as viewed successful:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: `Proxy error: ${error.message}` },
      { status: 500 }
    );
  }
}
