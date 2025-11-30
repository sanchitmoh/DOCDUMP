import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Search, MessageCircle, Phone, Mail } from "lucide-react"

export const metadata = {
  title: "Help Center - DocDump",
  description: "Get help and support for DocDump",
}

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-4">Help Center</h1>
          <p className="text-xl text-muted-foreground mb-12">Find answers and get support quickly</p>

          <div className="glass rounded-lg p-6 mb-12">
            <div className="flex items-center bg-card rounded-lg px-4 py-3 border border-border">
              <Search className="w-5 h-5 text-muted-foreground mr-3" />
              <input
                type="text"
                placeholder="Search help articles..."
                className="bg-transparent outline-none text-foreground flex-1 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="glass rounded-lg p-6 text-center">
              <MessageCircle className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Live Chat</h3>
              <p className="text-sm text-muted-foreground mb-3">Chat with our support team</p>
              <button className="text-primary hover:text-primary/80 transition font-medium text-sm">Start Chat</button>
            </div>

            <div className="glass rounded-lg p-6 text-center">
              <Phone className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Phone Support</h3>
              <p className="text-sm text-muted-foreground mb-3">Call us at +1 (555) 123-4567</p>
              <button className="text-cyan-400 hover:text-cyan-300 transition font-medium text-sm">
                Schedule Call
              </button>
            </div>

            <div className="glass rounded-lg p-6 text-center">
              <Mail className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Email Support</h3>
              <p className="text-sm text-muted-foreground mb-3">support@docdump.io</p>
              <button className="text-blue-400 hover:text-blue-300 transition font-medium text-sm">Send Email</button>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-6">Popular Articles</h2>
          <div className="space-y-3">
            {[
              "How to upload and organize documents",
              "Understanding document permissions",
              "Using advanced search and filters",
              "Sharing documents with team members",
              "Backing up your important documents",
            ].map((article, idx) => (
              <div
                key={idx}
                className="glass rounded-lg p-4 hover:border-primary border border-border transition cursor-pointer"
              >
                <p className="text-foreground font-medium">{article}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
