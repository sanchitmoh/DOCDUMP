import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Calendar, User, ArrowRight } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Blog - DocDump",
  description: "Read our latest articles and insights about document management",
}

export default function BlogPage() {
  const posts = [
    {
      id: 1,
      title: "The Future of Document Management",
      excerpt: "Discover how AI and automation are transforming enterprise document workflows.",
      author: "John Doe",
      date: "2024-11-15",
      category: "Insights",
    },
    {
      id: 2,
      title: "5 Best Practices for Document Organization",
      excerpt: "Learn proven strategies for organizing and categorizing documents effectively.",
      author: "Jane Smith",
      date: "2024-11-10",
      category: "Tips",
    },
    {
      id: 3,
      title: "Security in Document Management",
      excerpt: "Understanding the importance of data protection and access control in modern teams.",
      author: "Mike Johnson",
      date: "2024-11-05",
      category: "Security",
    },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-4">DocDump Blog</h1>
          <p className="text-xl text-muted-foreground mb-12">
            Insights, tips, and updates on document management and collaboration
          </p>

          <div className="space-y-6">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.id}`}>
                <div className="glass rounded-lg p-6 hover:border-primary border border-border transition cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                      {post.category}
                    </span>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-3">{post.title}</h2>
                  <p className="text-muted-foreground mb-4">{post.excerpt}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>{post.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{post.date}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
