import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen" style={{ maxWidth: '100vw' }}>
      <Sidebar />
      <div className="flex-1 md:ml-64 min-w-0" style={{ maxWidth: '100%' }}>
        <Header />
        <main className="p-4 md:p-6 pb-20 md:pb-6" style={{ maxWidth: '100%', overflowX: 'hidden' }}>{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
