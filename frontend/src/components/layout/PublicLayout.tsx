import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import primaryLogo from '@/assets/Primary Logo.png';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Facility', to: '/facility' },
  { label: 'Classes', to: '/classes' },
  { label: 'Memberships', to: '/memberships' },
  { label: 'Personal Training', to: '/training' },
  { label: 'Schedule', to: '/schedule' },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-6">
                  <div className="mb-6">
                    <Link to="/" aria-label="Go to Home">
                      <img src={primaryLogo} alt="BeFit" className="h-8 w-auto" />
                    </Link>
                  </div>
                  <nav className="flex flex-col gap-3">
                    {navItems.map(item => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground/80 hover:text-foreground'}`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </nav>
                  <div className="mt-6">
                    {user ? (
                      <Button
                        asChild
                        className="w-full rounded-xl border border-[#B7AAED]/70 bg-[#5A49BF]/80 text-white shadow-sm transition-colors hover:bg-[#4F42B0]/85"
                      >
                        <Link to="/dashboard">My Dashboard</Link>
                      </Button>
                    ) : (
                      <Link to="/login" className="text-sm font-medium text-primary hover:underline">
                        Log in
                      </Link>
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              <Link to="/" aria-label="Go to Home">
                <img src={primaryLogo} alt="BeFit" className="h-8 w-auto md:h-10" />
              </Link>
            </div>

            {user ? (
              <Button
                asChild
                size="sm"
                className="hidden md:inline-flex rounded-xl border border-[#B7AAED]/70 bg-[#5A49BF]/80 text-white shadow-sm transition-colors hover:bg-[#4F42B0]/85"
              >
                <Link to="/dashboard">My Dashboard</Link>
              </Button>
            ) : (
              <Link to="/login" className="hidden md:inline text-sm font-medium text-primary hover:underline">
                Log in
              </Link>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-6 mt-4">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium pb-2 border-b-2 transition-colors ${
                    isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
