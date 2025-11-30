import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Terms of Service - DocDump",
  description: "Read DocDump's terms of service and user agreement",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-8">Terms of Service</h1>

          <div className="space-y-8">
            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using DocDump, you accept and agree to be bound by the terms and provision of this
                agreement.
              </p>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">2. Use License</h2>
              <p className="text-muted-foreground leading-relaxed">
                Permission is granted to temporarily download one copy of the materials (information or software) on
                DocDump for personal, non-commercial transitory viewing only. This is the grant of a license, not a
                transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-3 space-y-2">
                <li>Modifying or copying the materials</li>
                <li>Using the materials for any commercial purpose or for any public display</li>
                <li>Attempting to decompile or reverse engineer any software contained on DocDump</li>
                <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
              </ul>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">3. Disclaimer</h2>
              <p className="text-muted-foreground leading-relaxed">
                The materials on DocDump are provided on an 'as is' basis. DocDump makes no warranties, expressed or
                implied, and hereby disclaims and negates all other warranties including, without limitation, implied
                warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of
                intellectual property or other violation of rights.
              </p>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">4. Limitations</h2>
              <p className="text-muted-foreground leading-relaxed">
                In no event shall DocDump or its suppliers be liable for any damages (including, without limitation,
                damages for loss of data or profit, or due to business interruption) arising out of the use or inability
                to use the materials on DocDump.
              </p>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">5. Accuracy of Materials</h2>
              <p className="text-muted-foreground leading-relaxed">
                The materials appearing on DocDump could include technical, typographical, or photographic errors.
                DocDump does not warrant that any of the materials on its website are accurate, complete, or current.
              </p>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">6. Modifications</h2>
              <p className="text-muted-foreground leading-relaxed">
                DocDump may revise these terms of service for its website at any time without notice. By using this
                website, you are agreeing to be bound by the then current version of these terms of service.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
