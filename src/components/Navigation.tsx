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
  Plus,
  BriefcaseBusiness,
  User, 
  CreditCard,
  LogOut,
  Download,
} from "lucide-react";

interface NavigationProps {
  showHistory?: boolean;
  showSearchSelector?: boolean;
}

const Navigation = (_props: NavigationProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentSearchId = searchParams.get('searchId');
  const { signOut } = useAuthContext();
  const { canInstall, promptInstall } = useInstallPrompt();

  const interviewsPath = currentSearchId ? `/dashboard?searchId=${currentSearchId}` : "/";

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
            <div className="hidden md:flex items-center gap-2">
              <Link
                to={interviewsPath}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/") || isActive("/dashboard") || isActive("/practice") || isActive("/history")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <BriefcaseBusiness className="h-4 w-4" />
                Interviews
              </Link>
              <Button asChild size="sm">
                <Link to="/">
                  <Plus className="mr-2 h-4 w-4" />
                  New interview
                </Link>
              </Button>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Account menu">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/pricing")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </DropdownMenuItem>
                  {canInstall && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleInstall}>
                        <Download className="mr-2 h-4 w-4" />
                        Install app
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
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
                      Navigate interviews or manage your account.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex items-center gap-2 font-bold text-xl mb-6">
                    <Brain className="h-6 w-6 text-primary" />
                    <span className="text-primary">Prepio</span>
                  </div>
                  
                  <div className="space-y-2">
                    <Link
                      to={interviewsPath}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full ${
                        isActive("/") || isActive("/dashboard") || isActive("/practice") || isActive("/history")
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <BriefcaseBusiness className="h-4 w-4" />
                      Interviews
                    </Link>
                    <Button asChild className="w-full justify-start">
                      <Link to="/">
                        <Plus className="mr-2 h-4 w-4" />
                        New interview
                      </Link>
                    </Button>
                  </div>

                  <div className="mt-6 space-y-2 border-t pt-6">
                    <Button variant="ghost" onClick={() => navigate("/profile")} className="w-full justify-start">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Button>
                    <Button variant="ghost" onClick={() => navigate("/pricing")} className="w-full justify-start">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </Button>
                    {canInstall && (
                      <Button variant="outline" onClick={handleInstall} className="w-full justify-start">
                        <Download className="mr-2 h-4 w-4" />
                        Install app
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
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
