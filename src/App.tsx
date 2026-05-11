import { useEffect, useState } from "react";
import { fetchUserAttributes, type AuthUser } from "aws-amplify/auth";
import Dashboard from "./pages/Dashboard";
import InvoiceDetail from "./pages/InvoiceDetail";
import { useAuthenticator } from "@aws-amplify/ui-react";


export type Page =
  | { name: "dashboard" }
  | { name: "detail"; invoiceId: string };

export interface NavigateFn {
  (name: "dashboard", params?: { user?: String }): void;
  (name: "detail", params: { invoiceId: string }): void;
}


function App() {
  const [page, setPage] = useState<Page>({ name: "dashboard" });
  const [email, setEmail] = useState<String | undefined>()
  const { user, signOut } = useAuthenticator();
  useEffect(() => {
    const getAttributes = async () => {
      try {
        const attributes = await fetchUserAttributes()
        console.log(attributes)
        setEmail(attributes.email)
      } catch (err) {
        console.log("Error fetching user attributes ", err)
      }
    }
    if (user) {
      getAttributes()
    }

  }, [user]);

  const navigate: NavigateFn = (name: any, params: any = {}) => {
    if (name === "dashboard") {
      setPage({ name: "dashboard" });
    } else if (name === "detail") {
      setPage({ name: "detail", invoiceId: params.invoiceId });
    }
  };

  return (
    <div className="app-root">
      <Header email={email} user={user} signOut={signOut} navigate={navigate} />
      <main className="app-main">
        {page.name === "dashboard" && (
          <Dashboard navigate={navigate} user={user} />
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
  email: String | undefined;
  signOut: () => void;
  navigate: NavigateFn;
};

function Header({ email, user, signOut, navigate }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <button className="logo" onClick={() => navigate("dashboard")}>
          <span className="logo-mark">▲</span>
          <span className="logo-text">Invoice</span>
        </button>
        <nav className="header-nav">
          <span className="nav-greeting">
            {email || user?.signInDetails?.loginId?.split("@")[0] || "User"}
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