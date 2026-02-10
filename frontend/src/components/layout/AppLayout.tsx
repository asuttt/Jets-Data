import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  LayoutDashboard, 
  Calendar, 
  BarChart3, 
  LogOut, 
  User,
  Menu,
  ScanLine
} from 'lucide-react';
import { cn } from '@/lib/utils';
import secondaryLogo from '@/assets/Secondary Logo.png';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout, isAdmin } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Today', 
      icon: LayoutDashboard,
      visible: true 
    },
    { 
      path: '/keytag', 
      label: 'Keytag', 
      icon: ScanLine,
      visible: true 
    },
    { 
      path: '/schedule', 
      label: 'Schedule', 
      icon: Calendar,
      visible: true 
    },
    { 
      path: '/insights', 
      label: 'Insights', 
      icon: BarChart3,
      visible: isAdmin 
    },
  ];

  const renderNavItems = (onNavigate?: () => void) => (
    <nav className="flex-1 p-4 space-y-2">
      {navItems.filter(item => item.visible).map(item => (
        <Link
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors",
            location.pathname === item.path
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/dashboard" aria-label="Go to Today">
            <img
              src={secondaryLogo}
              alt="BeFit"
              className="h-8 w-auto"
            />
          </Link>
        </div>

        {renderNavItems()}
      </aside>

      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar">
          <div className="p-6 border-b border-sidebar-border">
            <Link to="/dashboard" aria-label="Go to Today" onClick={() => setIsMobileNavOpen(false)}>
              <img src={secondaryLogo} alt="BeFit" className="h-8 w-auto" />
            </Link>
          </div>
          {renderNavItems(() => setIsMobileNavOpen(false))}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-4 py-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="h-4 w-4 text-sidebar-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user?.role}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                handleLogout();
                setIsMobileNavOpen(false);
              }}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="h-14 border-b border-border bg-background/95 backdrop-blur flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3 md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsMobileNavOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/dashboard" aria-label="Go to Today">
              <img src={secondaryLogo} alt="BeFit" className="h-6 w-auto" />
            </Link>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {children}
      </main>
    </div>
  );
}
