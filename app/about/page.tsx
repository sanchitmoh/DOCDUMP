import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Users, Award, Target, Lightbulb } from "lucide-react"

export const metadata = {
  title: "About Us - DocDump",
  description: "Learn about DocDump's mission to revolutionize document management",
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-foreground mb-4">About DocDump</h1>
            <p className="text-xl text-muted-foreground">
              Revolutionizing enterprise document management for the modern workforce
            </p>
          </div>

          {/* Mission */}
          <div className="glass rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              DocDump is dedicated to simplifying how organizations manage, share, and collaborate on documents. We
              believe that every employee should have instant access to the information they need, when they need it.
              Our platform combines powerful search capabilities, intelligent categorization, and seamless collaboration
              tools to transform document management from a burden into a competitive advantage.
            </p>
          </div>

          {/* Values */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="glass rounded-lg p-6 border-l-4 border-primary">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-6 h-6 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Collaboration</h3>
              </div>
              <p className="text-muted-foreground">
                We believe great work happens when teams can easily share and build on each other's ideas.
              </p>
            </div>

            <div className="glass rounded-lg p-6 border-l-4 border-cyan-500">
              <div className="flex items-center gap-3 mb-3">
                <Award className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-bold text-foreground">Excellence</h3>
              </div>
              <p className="text-muted-foreground">
                We're committed to delivering the highest quality product and customer experience.
              </p>
            </div>

            <div className="glass rounded-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center gap-3 mb-3">
                <Target className="w-6 h-6 text-blue-400" />
                <h3 className="text-lg font-bold text-foreground">Efficiency</h3>
              </div>
              <p className="text-muted-foreground">
                Time wasted searching for documents is time lost. We make finding information instant.
              </p>
            </div>

            <div className="glass rounded-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center gap-3 mb-3">
                <Lightbulb className="w-6 h-6 text-purple-400" />
                <h3 className="text-lg font-bold text-foreground">Innovation</h3>
              </div>
              <p className="text-muted-foreground">
                We continuously push the boundaries of what's possible in document management technology.
              </p>
            </div>
          </div>

          {/* Team Section */}
          <div className="glass rounded-lg p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Our Team</h2>
            <p className="text-muted-foreground leading-relaxed">
              DocDump is built by a passionate team of developers, designers, and document management experts who are
              dedicated to making enterprise document management accessible and enjoyable for everyone. We're constantly
              innovating and improving our platform based on feedback from our users.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
