"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState } from "react"
import { Search, DownloadCloud, Star } from "lucide-react"
import Link from "next/link"

const documents = [
  {
    id: 1,
    title: "Q4 Financial Report",
    author: "Finance Team",
    date: "2024-11-15",
    type: "PDF",
    views: 1203,
    size: "2.4 MB",
  },
  {
    id: 2,
    title: "Company Culture Guide",
    author: "HR Department",
    date: "2024-11-10",
    type: "PDF",
    views: 892,
    size: "1.8 MB",
  },
  {
    id: 3,
    title: "Product Roadmap 2025",
    author: "Product Team",
    date: "2024-11-12",
    type: "DOCX",
    views: 756,
    size: "3.1 MB",
  },
  {
    id: 4,
    title: "Engineering Best Practices",
    author: "Tech Team",
    date: "2024-11-08",
    type: "PDF",
    views: 654,
    size: "2.1 MB",
  },
  {
    id: 5,
    title: "Marketing Strategy Q4",
    author: "Marketing",
    date: "2024-11-14",
    type: "PPTX",
    views: 532,
    size: "4.2 MB",
  },
  { id: 6, title: "Employee Handbook", author: "HR", date: "2024-11-01", type: "PDF", views: 1891, size: "5.6 MB" },
]

export default function Browse() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("All")

  const filteredDocs = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedType === "All" || doc.type === selectedType),
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Document Library</h1>

          {/* Filters */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {["All", "PDF", "DOCX", "PPTX"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      selectedType === type
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Document List */}
          <div className="space-y-3">
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <div key={doc.id} className="glass glow-hover p-4 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <Link
                      href={`/document/${doc.id}`}
                      className="font-medium text-foreground hover:text-primary transition cursor-pointer block"
                    >
                      {doc.title}
                    </Link>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                      <span>{doc.author}</span>
                      <span>{doc.date}</span>
                      <span>{doc.views} views</span>
                      <span className="px-2 py-1 bg-primary/20 text-primary rounded">{doc.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 ml-4">
                    <span className="text-xs text-muted-foreground hidden md:inline">{doc.size}</span>
                    <button className="p-2 hover:bg-secondary rounded-lg transition">
                      <Star className="w-5 h-5 text-muted-foreground hover:text-yellow-400" />
                    </button>
                    <button className="p-2 hover:bg-secondary rounded-lg transition">
                      <DownloadCloud className="w-5 h-5 text-muted-foreground hover:text-primary" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No documents found</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
