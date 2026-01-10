"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, LogOut } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { usePathname } from "next/navigation"

interface NavbarProps {
  currentPage?: string
}

export function Navbar({ currentPage }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showPageHover, setShowPageHover] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()
  const pathname = usePathname()

  const getCurrentPageName = () => {
    if (pathname.includes("admin/profile")) return "Admin Profile"
    if (pathname.includes("admin") && !pathname.includes("analytics") && !pathname.includes("people")) return "Admin Dashboard"
    if (pathname.includes("dashboard")) return "Dashboard"
    if (pathname.includes("search")) return "Search"
    if (pathname.includes("library")) return "Library"
    if (pathname.includes("saved")) return "Saved Documents"
    if (pathname.includes("contributions")) return "Your Contributions"
    if (pathname.includes("analytics")) return "Analytics"
    if (pathname.includes("people")) return "People"
    return "DocDump"
  }

  const getNavLinkClass = (href: string) => {
    const isActive = pathname === href || pathname.startsWith(href)
    return `text-muted-foreground hover:text-foreground transition ${isActive ? "text-primary font-semibold" : ""}`
  }

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            href="/"
            className="flex items-center space-x-2 relative group"
            onMouseEnter={() => setShowPageHover(true)}
            onMouseLeave={() => setShowPageHover(false)}
          >
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">📚</span>
            </div>
            <span className="text-xl font-bold text-foreground">DocDump</span>

            {isAuthenticated && showPageHover && (
              <div className="absolute top-full left-0 mt-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                Current: {getCurrentPageName()}
              </div>
            )}
          </Link>

          {/* Desktop Menu */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center space-x-8">
              {user?.type === "organization" ? (
                <>
                  <Link href="/admin" className={getNavLinkClass("/admin")}>
                    Admin Dashboard
                  </Link>
                  <Link href="/admin/analytics" className={getNavLinkClass("/admin/analytics")}>
                    Analytics
                  </Link>
                  <Link href="/admin/people" className={getNavLinkClass("/admin/people")}>
                    People
                  </Link>
                  <Link href="/search" className={getNavLinkClass("/search")}>
                    Search
                  </Link>
                  <Link href="/library" className={getNavLinkClass("/library")}>
                    Library
                  </Link>
                  <Link href="/saved-documents" className={getNavLinkClass("/saved-documents")}>
                    Saved
                  </Link>
                  <Link href="/your-contributions" className={getNavLinkClass("/your-contributions")}>
                    Contributions
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/dashboard" className={getNavLinkClass("/dashboard")}>
                    Dashboard
                  </Link>
                  <Link href="/search" className={getNavLinkClass("/search")}>
                    Search
                  </Link>
                  <Link href="/library" className={getNavLinkClass("/library")}>
                    Library
                  </Link>
                  <Link href="/saved-documents" className={getNavLinkClass("/saved-documents")}>
                    Saved
                  </Link>
                  <Link href="/your-contributions" className={getNavLinkClass("/your-contributions")}>
                    Contributions
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Profile */}
          <div className="hidden md:flex items-center space-x-4">
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold hover:opacity-90 transition"
              >
                {isAuthenticated ? user?.email?.[0]?.toUpperCase() : "?"}
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg">
                  {!isAuthenticated ? (
                    <>
                      <Link
                        href="/login"
                        className="block px-4 py-2 text-foreground hover:bg-secondary rounded-t-lg transition"
                      >
                        Login
                      </Link>
                      <Link href="/signup" className="block px-4 py-2 text-foreground hover:bg-secondary transition">
                        Sign Up
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border">
                        {user?.email}
                        {user?.type === "organization" && (
                          <div className="text-xs text-primary mt-1">Organization Admin</div>
                        )}
                      </div>
                      {user?.type === "organization" ? (
                        <Link href="/admin/profile" className="block px-4 py-2 text-foreground hover:bg-secondary transition">
                          Admin Profile
                        </Link>
                      ) : (
                        <Link href="/profile" className="block px-4 py-2 text-foreground hover:bg-secondary transition">
                          Profile
                        </Link>
                      )}
                      <Link
                        href="/change-password"
                        className="block px-4 py-2 text-foreground hover:bg-secondary transition"
                      >
                        Change Password
                      </Link>
                      <button
                        onClick={() => {
                          setIsOpen(false)
                          logout()
                        }}
                        className="w-full text-left px-4 py-2 text-destructive hover:bg-secondary rounded-b-lg flex items-center space-x-2 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden">
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {isAuthenticated && (
              <>
                {user?.type === "organization" ? (
                  <>
                    <Link
                      href="/admin"
                      className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition"
                    >
                      Admin Dashboard
                    </Link>
                    <Link
                      href="/admin/analytics"
                      className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition"
                    >
                      Analytics
                    </Link>
                    <Link
                      href="/admin/people"
                      className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition"
                    >
                      People
                    </Link>
                    <Link href="/search" className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition">
                      Search
                    </Link>
                    <Link href="/library" className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition">
                      Library
                    </Link>
                    <Link
                      href="/saved-documents"
                      className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition"
                    >
                      Saved Documents
                    </Link>
                    <Link
                      href="/your-contributions"
                      className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition"
                    >
                      Your Contributions
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition"
                    >
                      Dashboard
                    </Link>
                    <Link href="/search" className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition">
                      Search
                    </Link>
                    <Link href="/library" className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition">
                      Library
                    </Link>
                    <Link
                      href="/saved-documents"
                      className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition"
                    >
                      Saved Documents
                    </Link>
                    <Link
                      href="/your-contributions"
                      className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition"
                    >
                      Your Contributions
                    </Link>
                  </>
                )}
                {user?.type === "organization" ? (
                  <Link href="/admin/profile" className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition">
                    Admin Profile
                  </Link>
                ) : (
                  <Link href="/profile" className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition">
                    Profile
                  </Link>
                )}
                <Link
                  href="/change-password"
                  className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition"
                >
                  Change Password
                </Link>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    logout()
                  }}
                  className="w-full text-left px-4 py-2 text-destructive hover:bg-secondary rounded-b-lg flex items-center space-x-2 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </>
            )}
            {!isAuthenticated && (
              <>
                <Link href="/login" className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition">
                  Login
                </Link>
                <Link href="/signup" className="block px-4 py-2 text-foreground hover:bg-secondary rounded transition">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
