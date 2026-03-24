import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 md:ml-64 min-w-0">
        <Header />
        <main className="p-4 md:p-6 pb-20 md:pb-6 min-w-0 overflow-x-hidden">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
