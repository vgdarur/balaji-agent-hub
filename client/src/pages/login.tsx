import { useEffect, useRef, useState } from "react";
import { useAuth, GOOGLE_CLIENT_ID } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initGSI = () => {
      if (!window.google) {
        setTimeout(initGSI, 200);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            setError(null);
            await login(response.credential);
          } catch (e: any) {
            setError(e.message || "Login failed");
          }
        },
      });

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "rectangular",
          width: 300,
          text: "signin_with",
        });
      }
    };

    initGSI();
  }, [login]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <svg
              width="44"
              height="44"
              viewBox="0 0 44 44"
              fill="none"
              aria-label="Balaji Agent Hub Logo"
            >
              <rect x="2" y="2" width="40" height="40" rx="10" stroke="hsl(174, 72%, 46%)" strokeWidth="2.5" fill="none" />
              <circle cx="22" cy="16" r="5" stroke="hsl(174, 72%, 46%)" strokeWidth="2" fill="none" />
              <path d="M12 34c0-6 4-10 10-10s10 4 10 10" stroke="hsl(174, 72%, 46%)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="11" cy="20" r="3" stroke="hsl(262, 72%, 56%)" strokeWidth="1.5" fill="none" />
              <circle cx="33" cy="20" r="3" stroke="hsl(38, 92%, 50%)" strokeWidth="1.5" fill="none" />
              <path d="M5 30c0-3 2-6 6-6" stroke="hsl(262, 72%, 56%)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M39 30c0-3-2-6-6-6" stroke="hsl(38, 92%, 50%)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight" data-testid="text-title">
                Balaji Agent Hub
              </h1>
              <p className="text-xs text-muted-foreground">
                Powered by Balaji · Job tracking for all agents
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-border" />

          <p className="text-sm text-muted-foreground text-center">
            Sign in with your Google account to access the dashboard
          </p>

          <div ref={googleBtnRef} data-testid="button-google-signin" />

          {error && (
            <p className="text-sm text-destructive text-center" data-testid="text-error">
              {error}
            </p>
          )}

          <footer className="text-xs text-muted-foreground text-center pt-4 border-t border-border w-full">
            <a
              href="https://www.perplexity.ai/computer"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Balaji Agent Hub · Powered by Perplexity Computer
            </a>
          </footer>
        </CardContent>
      </Card>
    </div>
  );
}
