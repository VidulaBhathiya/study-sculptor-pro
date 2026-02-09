import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Code2,
  LayoutDashboard,
  ClipboardCheck,
  BookOpen,
  Calendar,
  Settings,
  LogOut,
  Users,
  FileQuestion,
  Library,
} from "lucide-react";

const userLinks = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/quiz", icon: ClipboardCheck, label: "Take Quiz" },
  { to: "/recommendations", icon: BookOpen, label: "Resources" },
  { to: "/study-plan", icon: Calendar, label: "Study Plan" },
];

const adminLinks = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/questions", icon: FileQuestion, label: "Questions" },
  { to: "/admin/resources", icon: Library, label: "Resources" },
  { to: "/admin/users", icon: Users, label: "Users" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { role, signOut, user } = useAuth();
  const location = useLocation();
  const links = role === "admin" ? adminLinks : userLinks;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shrink-0">
        <div className="p-4 flex items-center gap-2 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-lg accent-gradient flex items-center justify-center">
            <Code2 className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="font-display font-bold text-lg">CodePath</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                role === "admin"
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}>
                {role}
              </span>
            </div>
            <div className="text-xs text-sidebar-foreground/50 truncate">
              {user?.email}
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
