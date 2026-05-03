import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a1628', color: '#e8d5b7',
      fontFamily: 'monospace', direction: 'rtl',
    }}>
      <h1 style={{ fontSize: '4rem', color: '#d4a017', marginBottom: '1rem' }}>٤٠٤</h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>الصفحة غير موجودة</p>
      <Link href="/" style={{ color: '#4ade80', textDecoration: 'underline' }}>العودة للرئيسية</Link>
    </div>
  );
}
