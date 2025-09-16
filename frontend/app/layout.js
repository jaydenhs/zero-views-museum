import "./globals.css";

export const metadata = {
  title: "VR Museum - Zero Views",
  description: "A virtual reality museum experience showcasing unseen artworks",
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={"antialiased"}>{children}</body>
    </html>
  );
}
