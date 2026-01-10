# Advanced Search System Documentation

## Overview

The Advanced Search System integrates Elasticsearch with your corporate digital library to provide powerful, fast, and comprehensive search capabilities across all documents, metadata, and content.

## Features

### 🔍 **Multi-Field Search**
- **File Names**: Search by document titles and filenames
- **Content**: Full-text search within document content
- **Extracted Text**: Search OCR-extracted text from images and PDFs
- **Metadata**: Search by author, department, tags, and descriptions
- **AI-Generated Content**: Search AI summaries and descriptions

### 🎯 **Search Types**
- **Basic Search**: Standard text search with auto-completion
- **Advanced Search**: Field-specific queries (e.g., `title:report AND department:engineering`)
- **Fuzzy Search**: Typo-tolerant search for misspelled queries
- **Exact Match**: Precise phrase matching

### 🔧 **Advanced Filters**
- **Departments**: Filter by organizational departments
- **File Types**: Filter by document formats (PDF, DOC, XLS, etc.)
- **Authors**: Filter by document creators/uploaders
- **Tags**: Filter by document tags and categories
- **Date Ranges**: Filter by creation or modification dates
- **File Sizes**: Filter by document size ranges
- **Visibility**: Filter by access levels (private, org, public)
- **Folder Paths**: Filter by document location
- **Content Availability**: Filter documents with/without extracted content
- **OCR Confidence**: Filter by text extraction quality

### 📊 **Faceted Search**
- **Dynamic Facets**: Real-time filter counts and options
- **Interactive Filtering**: Click facets to refine search results
- **Multi-Select**: Combine multiple filter values
- **Facet Counts**: See result counts for each filter option

### 🎨 **User Experience**
- **Auto-Complete**: Real-time search suggestions
- **Highlighting**: Search term highlighting in results
- **Pagination**: Efficient result browsing
- **Sorting**: Multiple sort options (relevance, date, size, etc.)
- **Responsive Design**: Works on desktop and mobile

## Architecture

### Components

1. **Elasticsearch Service** (`lib/search/elasticsearch.ts`)
   - Core search functionality
   - Document indexing and management
   - Query building and execution

2. **Search Integration Service** (`lib/services/search-integration.ts`)
   - Database-to-Elasticsearch synchronization
   - Bulk indexing operations
   - File lifecycle management

3. **API Routes**
   - `/api/search` - Main search endpoint
   - `/api/search/suggestions` - Auto-complete suggestions
   - `/api/search/manage` - Index management

4. **UI Components**
   - `SearchBar` - Main search input with suggestions
   - `AdvancedSearchModal` - Advanced search interface
   - `SearchResults` - Results display with facets

### Data Flow

```
User Input → Search Bar → API Route → Elasticsearch Service → Results → UI
     ↓
File Upload → Background Processor → Search Integration → Elasticsearch Index
```

## API Endpoints

### Search Documents
```http
GET /api/search?q={query}&page={page}&page_size={size}
POST /api/search
```

**Parameters:**
- `q`: Search query
- `department[]`: Department filters
- `file_type[]`: File type filters
- `author[]`: Author filters
- `tags[]`: Tag filters
- `visibility[]`: Visibility filters
- `date_from`: Start date (YYYY-MM-DD)
- `date_to`: End date (YYYY-MM-DD)
- `size_min`: Minimum file size (bytes)
- `size_max`: Maximum file size (bytes)
- `folder_path`: Folder path filter
- `has_content`: Content availability (true/false)
- `ocr_confidence_min`: Minimum OCR confidence (0-1)
- `search_type`: Search type (basic/advanced/fuzzy/exact)
- `highlight`: Enable highlighting (true/false)
- `sort_field`: Sort field
- `sort_order`: Sort order (asc/desc)
- `page`: Page number
- `page_size`: Results per page

### Search Suggestions
```http
GET /api/search/suggestions?q={partial_query}
```

### Search Management
```http
GET /api/search/manage          # Health check
POST /api/search/manage         # Management actions
```

**Management Actions:**
- `index_file`: Index a single file
- `remove_file`: Remove file from index
- `bulk_index`: Index multiple files
- `reindex_all`: Reindex entire organization
- `health_check`: Check Elasticsearch health

## Usage Examples

### Basic Search
```javascript
// Simple text search
const results = await fetch('/api/search?q=quarterly report')

// With filters
const results = await fetch('/api/search?q=budget&department=Finance&file_type=pdf')
```

### Advanced Search
```javascript
const searchParams = {
  query: 'title:budget AND department:finance',
  search_type: 'advanced',
  filters: {
    date_range: {
      from: '2024-01-01',
      to: '2024-12-31'
    },
    file_type: ['pdf', 'xlsx']
  },
  sort: {
    field: 'created_at',
    order: 'desc'
  }
}

const results = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(searchParams)
})
```

### Search Suggestions
```javascript
const suggestions = await fetch('/api/search/suggestions?q=budg')
// Returns: ["budget", "budget report", "budget analysis"]
```

## Configuration

### Environment Variables
```env
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=CorporateLib2024!
ELASTICSEARCH_INDEX_PREFIX=corporate
```

### Elasticsearch Mappings
The system uses optimized mappings for:
- Text analysis with custom analyzers
- Faceted search capabilities
- Highlighting support
- Auto-completion
- Multi-language support

## Performance Optimization

### Indexing
- **Batch Processing**: Files are indexed in batches for efficiency
- **Background Processing**: Indexing happens asynchronously
- **Content Truncation**: Large content is safely truncated
- **Validation**: Documents are validated before indexing

### Search
- **Caching**: Elasticsearch handles result caching
- **Pagination**: Efficient result pagination
- **Field Boosting**: Important fields get higher relevance scores
- **Facet Optimization**: Facets are computed efficiently

### Monitoring
- Health checks for Elasticsearch connectivity
- Indexing success/failure tracking
- Search performance metrics
- Error logging and debugging

## Integration Points

### File Upload Integration
When files are uploaded:
1. File is processed and stored
2. Text extraction occurs (OCR, parsing)
3. AI analysis generates summaries/tags
4. Document is automatically indexed in Elasticsearch

### File Update Integration
When files are updated:
1. Document metadata is updated
2. Elasticsearch index is refreshed
3. Search results reflect changes immediately

### File Deletion Integration
When files are deleted:
1. File is removed from storage
2. Document is removed from Elasticsearch index
3. Search results no longer include deleted files

## Troubleshooting

### Common Issues

1. **Elasticsearch Connection Failed**
   - Check if Elasticsearch is running
   - Verify connection credentials
   - Check network connectivity

2. **Search Returns No Results**
   - Verify documents are indexed
   - Check organization ID filtering
   - Review search query syntax

3. **Indexing Failures**
   - Check document validation errors
   - Verify Elasticsearch disk space
   - Review content size limits

### Debug Commands
```bash
# Check Elasticsearch health
curl -u elastic:password http://localhost:9200/_cluster/health

# Check index status
curl -u elastic:password http://localhost:9200/corporate_documents/_stats

# View index mappings
curl -u elastic:password http://localhost:9200/corporate_documents/_mapping
```

## Security

### Authentication
- All search endpoints require user authentication
- Organization-level data isolation
- Role-based access control

### Data Privacy
- Documents are filtered by organization
- Visibility settings are respected
- No cross-organization data leakage

### Content Security
- Input validation and sanitization
- XSS prevention in search results
- Safe content highlighting

## Future Enhancements

### Planned Features
- **Semantic Search**: AI-powered semantic understanding
- **Search Analytics**: Usage tracking and insights
- **Custom Analyzers**: Domain-specific text analysis
- **Multi-Language Support**: Enhanced language detection
- **Search Personalization**: User-specific result ranking
- **Real-time Indexing**: Instant search updates
- **Advanced OCR**: Better text extraction accuracy
- **Search Export**: Export search results to various formats

### Performance Improvements
- **Distributed Search**: Multi-node Elasticsearch setup
- **Caching Layer**: Redis-based result caching
- **Index Optimization**: Automated index maintenance
- **Query Optimization**: Advanced query performance tuning

## Support

For issues or questions about the search system:
1. Check the troubleshooting section
2. Review Elasticsearch logs
3. Test with the provided API endpoints
4. Verify system health with management endpoints

The Advanced Search System provides a comprehensive, scalable, and user-friendly search experience for your corporate digital library.