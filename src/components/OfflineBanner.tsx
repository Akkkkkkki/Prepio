import { WifiOff } from "lucide-react";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const OfflineBanner = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-950">
      <div className="container mx-auto flex items-center gap-3 px-4 py-3 text-sm">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <p>
          You&apos;re offline. You can review loaded screens, but research, auth, and practice saves
          stay disabled until you reconnect.
        </p>
      </div>
    </div>
  );
};

export default OfflineBanner;
