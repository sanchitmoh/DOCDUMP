import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { MapPin, DollarSign } from "lucide-react"

export const metadata = {
  title: "Careers - DocDump",
  description: "Join the DocDump team and help revolutionize document management",
}

export default function CareersPage() {
  const positions = [
    {
      title: "Senior Full Stack Engineer",
      department: "Engineering",
      location: "San Francisco, CA",
      type: "Full-time",
      salary: "$150k - $200k",
    },
    {
      title: "Product Manager",
      department: "Product",
      location: "New York, NY",
      type: "Full-time",
      salary: "$130k - $170k",
    },
    {
      title: "UX/UI Designer",
      department: "Design",
      location: "Remote",
      type: "Full-time",
      salary: "$100k - $140k",
    },
    {
      title: "Sales Executive",
      department: "Sales",
      location: "Chicago, IL",
      type: "Full-time",
      salary: "$80k - $150k + Commission",
    },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-4">Careers at DocDump</h1>
          <p className="text-xl text-muted-foreground mb-12">
            Join our team and help shape the future of document management
          </p>

          <div className="glass rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Why Join DocDump?</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li>Work on a product used by thousands of companies worldwide</li>
              <li>Competitive salary and comprehensive benefits</li>
              <li>Flexible work arrangements and remote options</li>
              <li>Professional development and growth opportunities</li>
              <li>Collaborative and inclusive company culture</li>
            </ul>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-6">Open Positions</h2>
          <div className="space-y-4">
            {positions.map((position, idx) => (
              <div key={idx} className="glass rounded-lg p-6 hover:border-primary border border-border transition">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-bold text-foreground">{position.title}</h3>
                  <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                    {position.type}
                  </span>
                </div>
                <p className="text-muted-foreground mb-3">{position.department}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{position.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    <span>{position.salary}</span>
                  </div>
                </div>
                <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium">
                  Apply Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
