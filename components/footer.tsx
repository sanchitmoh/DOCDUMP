import Link from 'next/link'
import { Mail, MessageSquare, Github, Linkedin, Twitter } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative border-t border-white/10 bg-gradient-to-b from-background/80 to-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">📚</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                DocDump
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Enterprise-grade document management for modern teams</p>
            <div className="flex space-x-3">
              <a href="#" className="p-2 rounded-lg bg-white/10 hover:bg-cyan-500/20 transition text-cyan-400 hover:text-cyan-300">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-white/10 hover:bg-cyan-500/20 transition text-cyan-400 hover:text-cyan-300">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-white/10 hover:bg-cyan-500/20 transition text-cyan-400 hover:text-cyan-300">
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4 relative inline-block">
              Resources
              <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-500 to-transparent group-hover:w-full transition-all duration-300"></span>
            </h3>
            <ul className="space-y-3">
              <li><Link href="/sitemap" className="footer-link text-muted-foreground">Sitemap</Link></li>
              <li><Link href="/terms" className="footer-link text-muted-foreground">Terms of Use</Link></li>
              <li><Link href="/privacy" className="footer-link text-muted-foreground">Privacy Policy</Link></li>
              <li><Link href="/security" className="footer-link text-muted-foreground">Security</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Support</h3>
            <ul className="space-y-3">
              <li><Link href="/help" className="footer-link text-muted-foreground">Help Center</Link></li>
              <li><Link href="/docs" className="footer-link text-muted-foreground">Documentation</Link></li>
              <li><Link href="/contact" className="footer-link text-muted-foreground">Contact Us</Link></li>
              <li className="flex items-center space-x-2 text-muted-foreground footer-link">
                <Mail className="w-4 h-4" />
                <a href="mailto:contact@docdump.io">contact@docdump.io</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-3">
              <li><Link href="/about" className="footer-link text-muted-foreground">About Us</Link></li>
              <li><Link href="/blog" className="footer-link text-muted-foreground">Blog</Link></li>
              <li><Link href="/careers" className="footer-link text-muted-foreground">Careers</Link></li>
              <li><Link href="/partners" className="footer-link text-muted-foreground">Partners</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <p>© {currentYear} DocDump. All rights reserved.</p>
            <p className="text-center">Made with passion for document management</p>
            <p className="text-right">
              Status:{' '}
              <span className="inline-flex items-center space-x-1 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span>All systems operational</span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
