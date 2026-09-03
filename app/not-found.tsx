import Link from 'next/link';
export default function NotFound() {
  return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(236,230,245,.6)', fontSize: 14 }}><div>Lost in space. <Link href="/">Back to the universe</Link></div></div>;
}
