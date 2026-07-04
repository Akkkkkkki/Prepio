import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthContext } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import {
  Brain,
  Menu,
  Home,
  BarChart3,
  Play,
  ClipboardList,
  User,
  CreditCard,
  LogOut,
  Download,
  MoreHorizontal,
} from "lucide-react";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentSearchId = searchParams.get('searchId');
  const { signOut } = useAuthContext();
  const { canInstall, promptInstall } = useInstallPrompt();

  // Primary nav stays on the work: the journey from research to practice to
  // review. Account-level surfaces (profile, billing) step aside into the menu.
  const navigationItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/practice", label: "Practice", icon: Play },
    { path: "/history", label: "Practice History", icon: ClipboardList },
  ];

  const accountItems = [
    { path: "/profile", label: "Profile", icon: User },
    { path: "/pricing", label: "Pricing", icon: CreditCard },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleInstall = async () => {
    await promptInstall();
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === path;
    }

    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const getNavigationPath = (path: string) => {
    // For practice page, always include searchId if available to ensure questions load
    if (path === "/practice" && currentSearchId) {
      return `${path}?searchId=${currentSearchId}`;
    }
    return currentSearchId ? `${path}?searchId=${currentSearchId}` : path;
  };

  return (
    <>
      <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 font-bold text-xl">
              <Brain className="h-6 w-6 text-primary" />
              <span className="text-primary">Prepio</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              {navigationItems.map((item) => (
                <Link
                  key={item.path}
                  to={getNavigationPath(item.path)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {accountItems.map((item) => (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link to={getNavigationPath(item.path)}>
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {canInstall && (
                    <>
                      <DropdownMenuItem onClick={handleInstall}>
                        <Download className="mr-2 h-4 w-4" />
                        Install app
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="outline" size="sm" aria-label="Open navigation menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="py-6">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation Menu</SheetTitle>
                    <SheetDescription>
                      Navigate the app.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex items-center gap-2 font-bold text-xl mb-6">
                    <Brain className="h-6 w-6 text-primary" />
                    <span className="text-primary">Prepio</span>
                  </div>

                  <div className="space-y-2">
                    {navigationItems.map((item) => (
                      <Link
                        key={item.path}
                        to={getNavigationPath(item.path)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full ${
                          isActive(item.path)
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t space-y-2">
                    {accountItems.map((item) => (
                      <Link
                        key={item.path}
                        to={getNavigationPath(item.path)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full ${
                          isActive(item.path)
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>

                  {canInstall && (
                    <div className="mt-6">
                      <Button variant="outline" onClick={handleInstall} className="w-full justify-start">
                        <Download className="mr-2 h-4 w-4" />
                        Install app
                      </Button>
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t">
                    <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;
