import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Shield, Lock, Users, AlertCircle } from "lucide-react"

export const metadata = {
  title: "Security - DocDump",
  description: "Learn about DocDump's security practices and commitments",
}

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-8">Security at DocDump</h1>

          <div className="space-y-8">
            <div className="glass rounded-lg p-6 border-l-4 border-primary">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">Data Protection</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                All data is encrypted in transit using TLS 1.2 and at rest using AES-256 encryption. We comply with
                GDPR, CCPA, and other international data protection regulations.
              </p>
            </div>

            <div className="glass rounded-lg p-6 border-l-4 border-cyan-500">
              <div className="flex items-center gap-3 mb-3">
                <Lock className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-bold text-foreground">Access Control</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                We implement role-based access control (RBAC) to ensure users only have access to documents they need.
                Multi-factor authentication is available for additional security.
              </p>
            </div>

            <div className="glass rounded-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-bold text-foreground">Compliance</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                DocDump is SOC 2 Type II certified and undergoes regular security audits. We maintain compliance with
                industry standards and best practices.
              </p>
            </div>

            <div className="glass rounded-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-foreground">Security Incident Response</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                We have a dedicated security team that monitors for threats 24/7. In the event of any security incident,
                we follow established protocols to notify affected users immediately.
              </p>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Report a Security Issue</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you discover a security vulnerability, please email our security team at security@docdump.io rather
                than publicly disclosing it. We appreciate responsible disclosure and will work with you to address any
                issues promptly.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
