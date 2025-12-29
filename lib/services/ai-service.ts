import OpenAI from 'openai'

// Debug logger utility
const debug = {
  log: (component: string, message: string, data?: any) => {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.log(`🤖 [AI-${component}] ${message}`, data ? JSON.stringify(data, null, 2) : '')
    }
  },
  error: (component: string, message: string, error?: any) => {
    console.error(`❌ [AI-${component}] ${message}`, error)
  },
  success: (component: string, message: string, data?: any) => {
    console.log(`✅ [AI-${component}] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

export interface AIGenerationContext {
  fileName?: string
  fileType?: string
  department?: string
  organization?: string
  existingTags?: string[]
  fileSize?: number
  mimeType?: string
  folderPath?: string
}

export interface AIGenerationOptions {
  maxLength?: number
  tone?: 'professional' | 'casual' | 'technical'
  language?: string
  includeKeywords?: boolean
  model?: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo-preview'
}

export interface AIGenerationResponse {
  result: string | string[]
  model: string
  tokensUsed?: number
  processingTime?: number
  confidence?: number
}

export class AIService {
  private openai: OpenAI
  private defaultModel: string = 'gpt-3.5-turbo'

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      debug.error('INIT', 'OpenAI API key not found in environment variables')
      throw new Error('OpenAI API key is required')
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    debug.success('INIT', 'AI Service initialized successfully')
  }

  /**
   * Generate content based on type and context
   */
  async generateContent({
    type,
    content,
    context = {},
    options = {}
  }: {
    type: 'description' | 'summary' | 'tags' | 'keywords' | 'title'
    content: string
    context?: AIGenerationContext
    options?: AIGenerationOptions
  }): Promise<AIGenerationResponse> {
    const startTime = Date.now()
    debug.log('GENERATE', `Starting ${type} generation`, { 
      contentLength: content.length, 
      context, 
      options 
    })

    try {
      const prompt = this.buildPrompt(type, content, context, options)
      const model = options.model || this.defaultModel

      debug.log('PROMPT', `Using model: ${model}`, { prompt: prompt.substring(0, 200) + '...' })

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(type, context, options)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.getMaxTokens(type, options),
        temperature: this.getTemperature(type),
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })

      const result = response.choices[0]?.message?.content?.trim()
      if (!result) {
        throw new Error('No content generated from OpenAI')
      }

      const processingTime = Date.now() - startTime
      const tokensUsed = response.usage?.total_tokens || 0

      debug.success('GENERATE', `${type} generated successfully`, {
        processingTime: `${processingTime}ms`,
        tokensUsed,
        resultLength: result.length
      })

      // Parse result based on type
      const parsedResult = this.parseResult(type, result)

      return {
        result: parsedResult,
        model,
        tokensUsed,
        processingTime,
        confidence: this.calculateConfidence(response)
      }

    } catch (error) {
      debug.error('GENERATE', `Failed to generate ${type}`, error)
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate smart file summary with advanced analysis
   */
  async generateAdvancedSummary(
    content: string,
    context: AIGenerationContext,
    options: AIGenerationOptions = {}
  ): Promise<AIGenerationResponse> {
    debug.log('ADVANCED_SUMMARY', 'Starting advanced summary generation', { context })

    const enhancedOptions = {
      ...options,
      model: options.model || 'gpt-4-turbo-preview',
      maxLength: options.maxLength || 500
    }

    const systemPrompt = `You are an expert document analyst for a corporate digital library. 
    Generate a comprehensive, professional summary that includes:
    
    1. **Main Purpose**: What is this document for?
    2. **Key Points**: 3-5 most important points
    3. **Relevance**: How it relates to ${context.department || 'the organization'}
    4. **Action Items**: Any tasks or decisions mentioned
    5. **Classification**: Document type and importance level
    
    Format as structured text with clear sections. Be concise but thorough.
    Target audience: ${context.department || 'corporate'} professionals.`

    try {
      const response = await this.openai.chat.completions.create({
        model: enhancedOptions.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Analyze this document and provide a comprehensive summary:

**File**: ${context.fileName || 'Document'}
**Type**: ${context.fileType || 'Unknown'}
**Department**: ${context.department || 'General'}
**Organization**: ${context.organization || 'Corporate'}

**Content**:
${content.substring(0, 4000)}${content.length > 4000 ? '...' : ''}

Please provide a structured summary following the format specified.`
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      })

      const result = response.choices[0]?.message?.content?.trim()
      if (!result) throw new Error('No summary generated')

      debug.success('ADVANCED_SUMMARY', 'Advanced summary generated', {
        tokensUsed: response.usage?.total_tokens
      })

      return {
        result,
        model: enhancedOptions.model,
        tokensUsed: response.usage?.total_tokens,
        processingTime: Date.now() - Date.now()
      }

    } catch (error) {
      debug.error('ADVANCED_SUMMARY', 'Failed to generate advanced summary', error)
      throw error
    }
  }

  /**
   * Generate intelligent tags based on content and context
   */
  async generateSmartTags(
    content: string,
    context: AIGenerationContext,
    maxTags: number = 8
  ): Promise<string[]> {
    debug.log('SMART_TAGS', 'Generating smart tags', { maxTags, context })

    const systemPrompt = `You are a document classification expert. Generate relevant, professional tags for corporate documents.

Rules:
- Return ${maxTags} most relevant tags
- Use professional, business-appropriate terms
- Consider document type, department, and content
- Include both specific and general tags
- Format as comma-separated list
- No hashtags or special characters

Existing tags in system: ${context.existingTags?.join(', ') || 'None'}`

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Generate tags for this document:

File: ${context.fileName}
Type: ${context.fileType}
Department: ${context.department}
Size: ${context.fileSize ? `${Math.round(context.fileSize / 1024)}KB` : 'Unknown'}

Content preview:
${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}

Generate ${maxTags} relevant tags:`
          }
        ],
        max_tokens: 200,
        temperature: 0.4
      })

      const result = response.choices[0]?.message?.content?.trim()
      if (!result) return []

      const tags = result
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 2 && tag.length < 30)
        .slice(0, maxTags)

      debug.success('SMART_TAGS', `Generated ${tags.length} tags`, { tags })
      return tags

    } catch (error) {
      debug.error('SMART_TAGS', 'Failed to generate smart tags', error)
      return []
    }
  }

  /**
   * Analyze document and suggest improvements
   */
  async analyzeDocument(
    content: string,
    context: AIGenerationContext
  ): Promise<{
    quality: number
    suggestions: string[]
    classification: string
    sentiment: 'positive' | 'neutral' | 'negative'
    readabilityScore: number
  }> {
    debug.log('ANALYZE', 'Starting document analysis', { context })

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a document quality analyst. Analyze the document and return a JSON response with:
            {
              "quality": number (1-10),
              "suggestions": ["suggestion1", "suggestion2"],
              "classification": "document type",
              "sentiment": "positive|neutral|negative",
              "readabilityScore": number (1-10)
            }`
          },
          {
            role: 'user',
            content: `Analyze this document:

File: ${context.fileName}
Department: ${context.department}

Content:
${content.substring(0, 3000)}

Provide analysis as JSON.`
          }
        ],
        max_tokens: 400,
        temperature: 0.2
      })

      const result = response.choices[0]?.message?.content?.trim()
      if (!result) throw new Error('No analysis generated')

      const analysis = JSON.parse(result)
      debug.success('ANALYZE', 'Document analysis completed', analysis)

      return analysis

    } catch (error) {
      debug.error('ANALYZE', 'Document analysis failed', error)
      return {
        quality: 5,
        suggestions: ['Unable to analyze document'],
        classification: 'unknown',
        sentiment: 'neutral',
        readabilityScore: 5
      }
    }
  }

  // Private helper methods
  private buildPrompt(
    type: string,
    content: string,
    context: AIGenerationContext,
    options: AIGenerationOptions
  ): string {
    const baseInfo = `
File: ${context.fileName || 'Document'}
Type: ${context.fileType || 'Unknown'}
Department: ${context.department || 'General'}
Organization: ${context.organization || 'Corporate'}
`

    switch (type) {
      case 'description':
        return `${baseInfo}
Content: ${content.substring(0, 2000)}

Generate a professional description (max ${options.maxLength || 200} characters) that explains what this document contains and its purpose.`

      case 'summary':
        return `${baseInfo}
Content: ${content.substring(0, 4000)}

Create a comprehensive summary highlighting the key points, main topics, and important information.`

      case 'tags':
        return `${baseInfo}
Existing tags: ${context.existingTags?.join(', ') || 'None'}
Content: ${content.substring(0, 2000)}

Generate 5-8 relevant tags for this document. Return as comma-separated list.`

      default:
        return content
    }
  }

  private getSystemPrompt(
    type: string,
    context: AIGenerationContext,
    options: AIGenerationOptions
  ): string {
    const tone = options.tone || 'professional'
    const language = options.language || 'English'

    return `You are an AI assistant specialized in corporate document management. 
    Generate ${type} in ${language} with a ${tone} tone. 
    Focus on accuracy, relevance, and business value.
    Consider the corporate context: ${context.organization || 'business environment'}.`
  }

  private getMaxTokens(type: string, options: AIGenerationOptions): number {
    if (options.maxLength) {
      return Math.min(Math.ceil(options.maxLength * 1.5), 1000)
    }

    switch (type) {
      case 'description': return 150
      case 'summary': return 500
      case 'tags': return 100
      case 'keywords': return 80
      case 'title': return 50
      default: return 200
    }
  }

  private getTemperature(type: string): number {
    switch (type) {
      case 'tags':
      case 'keywords': return 0.3
      case 'description': return 0.4
      case 'summary': return 0.5
      case 'title': return 0.6
      default: return 0.5
    }
  }

  private parseResult(type: string, result: string): string | string[] {
    if (type === 'tags' || type === 'keywords') {
      return result
        .split(',')
        .map(item => item.trim().toLowerCase())
        .filter(item => item.length > 0)
        .slice(0, 10)
    }
    return result
  }

  private calculateConfidence(response: any): number {
    // Simple confidence calculation based on response quality
    const choice = response.choices[0]
    if (choice?.finish_reason === 'stop') return 0.9
    if (choice?.finish_reason === 'length') return 0.7
    return 0.5
  }
}

// Factory function
export function createAIService(): AIService {
  return new AIService()
}

// Export debug utility for other services
export { debug as aiDebug }