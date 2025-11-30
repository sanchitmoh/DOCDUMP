import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Mail, Phone, MapPin } from "lucide-react"

export const metadata = {
  title: "Contact Us - DocDump",
  description: "Get in touch with the DocDump team",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-4">Contact Us</h1>
          <p className="text-xl text-muted-foreground mb-12">
            We'd love to hear from you. Get in touch with the DocDump team.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="glass rounded-lg p-6 text-center">
              <Mail className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Email</h3>
              <p className="text-muted-foreground">contact@docdump.io</p>
            </div>

            <div className="glass rounded-lg p-6 text-center">
              <Phone className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Phone</h3>
              <p className="text-muted-foreground">+1 (555) 123-4567</p>
            </div>

            <div className="glass rounded-lg p-6 text-center">
              <MapPin className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Address</h3>
              <p className="text-muted-foreground">San Francisco, CA 94105</p>
            </div>
          </div>

          <div className="glass rounded-lg p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Send us a Message</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                <input
                  type="text"
                  className="w-full bg-card border border-border rounded-lg px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email"
                  className="w-full bg-card border border-border rounded-lg px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Subject</label>
                <input
                  type="text"
                  className="w-full bg-card border border-border rounded-lg px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="Message subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Message</label>
                <textarea
                  rows={5}
                  className="w-full bg-card border border-border rounded-lg px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                  placeholder="Your message..."
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
