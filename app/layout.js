import './globals.css';
export const metadata = {
  title: 'Zombie Shooter',
  description: 'Top-down 2D zombie shooter game',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#000', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}
