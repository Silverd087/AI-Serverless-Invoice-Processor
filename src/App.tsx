import { useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import type { AuthUser } from "aws-amplify/auth";
import Dashboard from "./pages/Dashboard";
import InvoiceDetail from "./pages/InvoiceDetail";
import { useAuthenticator } from "@aws-amplify/ui-react";


export type Page =
  | { name: "dashboard" }
  | { name: "detail"; invoiceId: string };

export interface NavigateFn {
  (name: "dashboard", params?: {}): void;
  (name: "detail", params: { invoiceId: string }): void;
}


function App() {
  const [page, setPage] = useState<Page>({ name: "dashboard" });
  const { user, signOut, authStatus } = useAuthenticator();

  console.log("Auth Status:", authStatus);
  console.log("User Object:", user);

  if (authStatus !== 'authenticated') {
    // If you see this in the console after "logging in", 
    // the session isn't being saved to the browser.
    return null;
  }

  const navigate: NavigateFn = (name: any, params: any = {}) => {
    if (name === "dashboard") {
      setPage({ name: "dashboard" });
    } else if (name === "detail") {
      setPage({ name: "detail", invoiceId: params.invoiceId });
    }
  };

  return (
    <div className="app-root">
      <Header user={user} signOut={signOut} navigate={navigate} currentPage={page.name} />
      <main className="app-main">
        {page.name === "dashboard" && (
          <Dashboard navigate={navigate} />
        )}
        {page.name === "detail" && (
          <InvoiceDetail invoiceId={page.invoiceId} navigate={navigate} />
        )}
      </main>
    </div>
  );
}

type HeaderProps = {
  user: AuthUser;
  signOut: () => void;
  navigate: NavigateFn;
  currentPage: string;
};

function Header({ user, signOut, navigate, currentPage }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <button className="logo" onClick={() => navigate("dashboard")}>
          <span className="logo-mark">▲</span>
          <span className="logo-text">Invoice</span>
        </button>
        <nav className="header-nav">
          <span className="nav-greeting">
            {user?.signInDetails?.loginId?.split("@")[0] || "User"}
          </span>
          <button className="btn-signout" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

export default App;