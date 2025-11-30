import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { BookOpen, Video, Code, HelpCircle } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Documentation - DocDump",
  description: "Complete documentation and guides for DocDump",
}

export default function DocsPage() {
  const docs = [
    {
      icon: BookOpen,
      title: "Getting Started",
      description: "Learn the basics of DocDump and set up your account",
      href: "#getting-started",
    },
    {
      icon: Code,
      title: "API Reference",
      description: "Integrate DocDump with your applications using our API",
      href: "#api-reference",
    },
    {
      icon: Video,
      title: "Video Tutorials",
      description: "Watch step-by-step tutorials on using DocDump features",
      href: "#tutorials",
    },
    {
      icon: HelpCircle,
      title: "FAQ",
      description: "Find answers to frequently asked questions",
      href: "#faq",
    },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-4">Documentation</h1>
          <p className="text-xl text-muted-foreground mb-12">Everything you need to know about using DocDump</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {docs.map((doc) => {
              const Icon = doc.icon
              return (
                <Link key={doc.title} href={doc.href}>
                  <div className="glass rounded-lg p-6 hover:border-primary border border-border transition cursor-pointer h-full">
                    <Icon className="w-8 h-8 text-primary mb-3" />
                    <h3 className="text-lg font-bold text-foreground mb-2">{doc.title}</h3>
                    <p className="text-muted-foreground">{doc.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="glass rounded-lg p-8 space-y-6">
            <div id="getting-started">
              <h2 className="text-2xl font-bold text-foreground mb-3">Getting Started</h2>
              <p className="text-muted-foreground leading-relaxed">
                Create your DocDump account and start uploading documents. Learn about organizing documents, setting
                permissions, and collaborating with your team.
              </p>
            </div>

            <div id="api-reference">
              <h2 className="text-2xl font-bold text-foreground mb-3">API Reference</h2>
              <p className="text-muted-foreground leading-relaxed">
                Access our REST API to integrate DocDump with your applications. Full documentation with examples and
                SDKs available.
              </p>
            </div>

            <div id="tutorials">
              <h2 className="text-2xl font-bold text-foreground mb-3">Video Tutorials</h2>
              <p className="text-muted-foreground leading-relaxed">
                Watch our collection of video tutorials covering everything from basic features to advanced workflows.
              </p>
            </div>

            <div id="faq">
              <h2 className="text-2xl font-bold text-foreground mb-3">FAQ</h2>
              <p className="text-muted-foreground leading-relaxed">
                Find answers to common questions about DocDump features, pricing, and support.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
