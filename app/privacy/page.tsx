import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Privacy Policy - DocDump",
  description: "Read DocDump's privacy policy and data protection practices",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>

          <div className="space-y-8">
            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">1. Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                We collect information you provide directly to us, such as when you create an account, upload documents,
                or contact us for support. This includes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Name and email address</li>
                <li>Company and department information</li>
                <li>Documents and file content you upload</li>
                <li>Communication preferences</li>
              </ul>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">2. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the information we collect to provide, maintain, and improve our services, process transactions,
                send transactional and promotional communications, and comply with legal obligations.
              </p>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">3. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information
                against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission
                over the Internet is 100% secure.
              </p>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">4. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed">
                You have the right to access, update, or delete your personal information at any time. You can do this
                by logging into your account or contacting us at privacy@docdump.io.
              </p>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">5. Third-Party Links</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our website may contain links to third-party websites. We are not responsible for the privacy practices
                or content of these external sites. We encourage you to review their privacy policies.
              </p>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">6. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about this Privacy Policy or our privacy practices, please contact us at
                privacy@docdump.io or visit our Help Center.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
