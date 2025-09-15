import "./globals.css";

export const metadata = {
  title: "VR Museum - Zero Views",
  description: "A virtual reality museum experience showcasing unseen artworks",
  viewport: "width=device-width, initial-scale=1.0, user-scalable=no",
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* VR/Quest 2 specific meta tags */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, user-scalable=no, shrink-to-fit=no"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        {/* WebXR meta tags */}
        <meta name="webxr" content="true" />
        <meta name="xr-spatial-tracking" content="true" />

        {/* Security and sandbox meta tags for Quest 2 */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https:; worker-src 'self' blob: data:; child-src 'self' blob: data:; object-src 'none'; base-uri 'self';"
        />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />

        {/* Performance and compatibility */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Preload critical resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className={"antialiased"}>{children}</body>
    </html>
  );
}
