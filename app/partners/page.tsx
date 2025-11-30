import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Network, Handshake, TrendingUp } from "lucide-react"

export const metadata = {
  title: "Partners - DocDump",
  description: "Become a DocDump partner and grow your business together",
}

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-4">Partner with DocDump</h1>
          <p className="text-xl text-muted-foreground mb-12">
            Grow your business by partnering with the leading document management platform
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="glass rounded-lg p-6 border-l-4 border-primary">
              <Network className="w-8 h-8 text-primary mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-2">Integration Partners</h3>
              <p className="text-muted-foreground text-sm">
                Integrate your product with DocDump to provide value to your customers
              </p>
            </div>

            <div className="glass rounded-lg p-6 border-l-4 border-cyan-500">
              <Handshake className="w-8 h-8 text-cyan-400 mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-2">Reseller Partners</h3>
              <p className="text-muted-foreground text-sm">
                Resell DocDump to your clients with attractive margins and support
              </p>
            </div>

            <div className="glass rounded-lg p-6 border-l-4 border-blue-500">
              <TrendingUp className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-2">Strategic Partners</h3>
              <p className="text-muted-foreground text-sm">
                Collaborate on joint go-to-market initiatives and co-development projects
              </p>
            </div>
          </div>

          <div className="glass rounded-lg p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Why Partner with DocDump?</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li>✓ Access to a growing customer base</li>
                <li>✓ Comprehensive partner support and resources</li>
                <li>✓ Competitive partner programs and incentives</li>
                <li>✓ Joint marketing opportunities</li>
                <li>✓ Technical integration support</li>
              </ul>
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="font-bold text-foreground mb-3">Interested in partnering?</h3>
              <p className="text-muted-foreground mb-4">
                Contact our partnerships team to discuss how we can work together
              </p>
              <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium">
                Get in Touch
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
