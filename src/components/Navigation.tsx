import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthContext } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Brain, 
  Menu, 
  Home, 
  BarChart3, 
  Play, 
  User, 
  History,
  LogOut,
  Loader2,
  AlertCircle,
  ChevronDown
} from "lucide-react";
import { searchService } from "@/services/searchService";

interface NavigationProps {
  showHistory?: boolean;
  showSearchSelector?: boolean;
}

interface SearchHistoryItem {
  id: string;
  company: string;
  role: string | null;
  country: string | null;
  status: string;
  created_at: string;
}

const Navigation = ({ showHistory = true, showSearchSelector = true }: NavigationProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentSearchId = searchParams.get('searchId');
  const { signOut, user } = useAuthContext();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const navigationItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/practice", label: "Practice", icon: Play },
    { path: "/profile", label: "Profile", icon: User },
  ];

  // Load search history when component mounts and user is authenticated
  useEffect(() => {
    const loadSearchHistory = async () => {
      if (!user) return;

      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const result = await searchService.getSearchHistory();
        
        if (result.success && result.searches) {
          setSearchHistory(result.searches);
        } else {
          setHistoryError("Failed to load search history");
        }
      } catch (err) {
        console.error("Error loading search history:", err);
        setHistoryError("Failed to load search history");
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadSearchHistory();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleHistoryItemClick = (searchItem: SearchHistoryItem) => {
    navigate(`/dashboard?searchId=${searchItem.id}`);
    setIsHistoryOpen(false);
  };

  const handleSearchSelection = (searchId: string) => {
    const currentPath = location.pathname;
    if (searchId === "none") {
      navigate(currentPath);
    } else {
      navigate(`${currentPath}?searchId=${searchId}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="text-xs text-green-600 bg-green-100">Completed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="text-xs text-blue-600 bg-blue-100">Processing</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="text-xs text-yellow-600 bg-yellow-100">Pending</Badge>;
      case 'failed':
        return <Badge variant="secondary" className="text-xs text-red-600 bg-red-100">Failed</Badge>;
      default:
        return null;
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const getCurrentSearchDisplay = () => {
    if (!currentSearchId) return "Choose research";
    const currentSearch = searchHistory.find(search => search.id === currentSearchId);
    if (!currentSearch) return "Select from history";
    return `${currentSearch.company}${currentSearch.role ? ` - ${currentSearch.role}` : ''}`;
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
              {/* Search Selector */}
              {showSearchSelector && searchHistory.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Active research
                  </p>
                  <Select value={currentSearchId || "none"} onValueChange={handleSearchSelection}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Choose research">
                        {getCurrentSearchDisplay()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose research</SelectItem>
                      {searchHistory.map((search) => (
                        <SelectItem key={search.id} value={search.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{search.company}{search.role ? ` - ${search.role}` : ''}</span>
                            {getStatusBadge(search.status)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showHistory && (
                <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <History className="h-4 w-4 mr-2" />
                      History
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80">
                    <div className="py-6">
                      <SheetHeader className="mb-4 text-left">
                        <SheetTitle>Search History</SheetTitle>
                        <SheetDescription>
                          Open one of your previous research runs from the navigation history.
                        </SheetDescription>
                      </SheetHeader>
                      
                      {isLoadingHistory ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
                        </div>
                      ) : historyError ? (
                        <div className="flex items-center gap-2 p-3 border border-red-200 rounded-lg bg-red-50">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-800">{historyError}</span>
                        </div>
                      ) : searchHistory.length === 0 ? (
                        <div className="text-center py-8">
                          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm text-muted-foreground">No search history yet</p>
                          <p className="text-xs text-muted-foreground">Start a new search to see it here</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {searchHistory.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => handleHistoryItemClick(item)}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="font-medium truncate">{item.company}</div>
                                {getStatusBadge(item.status)}
                              </div>
                              {item.role && (
                                <div className="text-sm text-muted-foreground mb-1">{item.role}</div>
                              )}
                              {item.country && (
                                <div className="text-xs text-muted-foreground mb-1">{item.country}</div>
                              )}
                              <div className="text-xs text-muted-foreground">{formatDate(item.created_at)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="py-6">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation Menu</SheetTitle>
                    <SheetDescription>
                      Navigate the app, switch active research, and review recent searches.
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

                  {/* Mobile Search Selector */}
                  {showSearchSelector && searchHistory.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-medium mb-3">Active Research</h3>
                      <Select value={currentSearchId || "none"} onValueChange={handleSearchSelection}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose research">
                            {getCurrentSearchDisplay()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Choose research</SelectItem>
                          {searchHistory.map((search) => (
                            <SelectItem key={search.id} value={search.id}>
                              {search.company}{search.role ? ` - ${search.role}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {showHistory && (
                    <div className="mt-6">
                      <h3 className="font-medium mb-3">Recent Searches</h3>
                      {isLoadingHistory ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                        </div>
                      ) : searchHistory.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-xs text-muted-foreground">No searches yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {searchHistory.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className="p-2 border rounded cursor-pointer hover:bg-muted text-sm"
                              onClick={() => handleHistoryItemClick(item)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-medium truncate">{item.company}</div>
                                {getStatusBadge(item.status)}
                              </div>
                              {item.role && (
                                <div className="text-xs text-muted-foreground">{item.role}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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
