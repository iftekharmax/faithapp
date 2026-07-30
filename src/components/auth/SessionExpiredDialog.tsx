import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SessionExpiredDialog() {
  const { sessionExpired, dismissSessionExpired, signOut } = useAuth();
  const navigate = useNavigate();

  const handleReLogin = async () => {
    dismissSessionExpired();
    await signOut();
    navigate({ to: "/auth/login", replace: true });
  };

  return (
    <AlertDialog open={sessionExpired}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-center">Your session has expired</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            For your security, please sign in again to continue where you left off.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={handleReLogin}>Sign in again</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
