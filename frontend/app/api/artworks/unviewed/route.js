import { NextResponse } from "next/server";
import https from "https";

const FLASK_SERVER_URL = "https://zvm.jaydenh.com:5001";

// Create HTTPS agent that ignores SSL certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  checkServerIdentity: () => null,
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "4";

    console.log(
      `Proxying unviewed artworks request to Flask server (limit: ${limit})...`
    );

    const response = await fetch(
      `${FLASK_SERVER_URL}/api/artworks/unviewed?limit=${limit}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // Use custom HTTPS agent to ignore SSL certificate errors
        agent: httpsAgent,
      }
    );

    if (!response.ok) {
      console.error(`Flask server responded with status: ${response.status}`);
      return NextResponse.json(
        { error: `Flask server error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`Retrieved ${data.length} unviewed artworks`);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: `Proxy error: ${error.message}` },
      { status: 500 }
    );
  }
}
